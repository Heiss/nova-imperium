// The parts of the E2E suite in CI (#372): every spec file runs in exactly
// one part, a new one too, and the plan balances the measured times.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filesOf,
  hashOf,
  loadOf,
  PARTS,
  partOf,
  planOf,
  PLAN_FILE,
  type Plan,
  specFiles,
  timesOf,
} from '../../scripts/e2e-shards.ts';

const CI = readFileSync('.github/workflows/ci.yml', 'utf8');

describe('the parts of the E2E suite (#372)', () => {
  const files = [
    'e2e/a.spec.ts',
    'e2e/b.spec.ts',
    'e2e/c.spec.ts',
    'e2e/d.spec.ts',
  ];

  it('put every spec file of the tree into exactly one part of the plan', () => {
    const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8')) as Plan;
    expect(plan.parts).toBe(PARTS);
    const all = specFiles();
    const parts = Array.from({ length: PARTS }, (_, i) =>
      filesOf(i + 1, all, plan),
    );
    expect(parts.flat().sort()).toEqual(all);
    for (const part of parts) expect(part.length).toBeGreaterThan(0);
  });

  it('name files that Playwright, which reads each argument as a pattern of the path, matches only once', () => {
    const all = specFiles();
    for (const file of all)
      expect(
        all.filter((other) => new RegExp(file).test(`/repo/${other}`)),
        file,
      ).toEqual([file]);
  });

  it('find the spec files in folders below e2e/ too (CodeRabbit 4679061313)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'e2e-shards-'));
    try {
      for (const f of [
        'a.spec.ts',
        'x/y.spec.ts',
        'x/z/w.spec.ts',
        'helpers.ts',
        'x/data.json',
      ]) {
        mkdirSync(join(dir, f, '..'), { recursive: true });
        writeFileSync(join(dir, f), '');
      }
      expect(specFiles(dir)).toEqual([
        `${dir}/a.spec.ts`,
        `${dir}/x/y.spec.ts`,
        `${dir}/x/z/w.spec.ts`,
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('spread files without a time over every part (CodeRabbit 4679061321)', () => {
    const none = new Map(files.map((f) => [f, 0]));
    const plan = planOf(files, none, 4);
    expect(new Set(Object.values(plan.files))).toEqual(new Set([1, 2, 3, 4]));
    // The reported times stay what was measured.
    expect(loadOf(plan, none)).toEqual([0, 0, 0, 0]);
    expect(planOf(files, new Map(), 2).files).toEqual({
      'e2e/a.spec.ts': 1,
      'e2e/b.spec.ts': 2,
      'e2e/c.spec.ts': 1,
      'e2e/d.spec.ts': 2,
    });
  });

  it('give a spec file the plan does not know the part of its name, the same every time', () => {
    const plan: Plan = { parts: 3, files: { 'e2e/a.spec.ts': 2 } };
    expect(partOf('e2e/a.spec.ts', plan)).toBe(2);
    const added = partOf('e2e/new.spec.ts', plan);
    expect(added).toBe((hashOf('e2e/new.spec.ts') % 3) + 1);
    expect(partOf('e2e/new.spec.ts', plan)).toBe(added);
    // A part outside the plan counts as unknown.
    expect(
      partOf('e2e/b.spec.ts', { parts: 3, files: { 'e2e/b.spec.ts': 7 } }),
    ).toBe((hashOf('e2e/b.spec.ts') % 3) + 1);
  });

  it('refuse a part that does not exist', () => {
    const plan: Plan = { parts: 3, files: {} };
    for (const part of [0, 4, 1.5, Number.NaN])
      expect(() => filesOf(part, files, plan)).toThrow(
        'There are the parts 1 to 3',
      );
  });

  it('plan the longest file first into the part with the least time', () => {
    const times = new Map([
      ['e2e/a.spec.ts', 10],
      ['e2e/b.spec.ts', 7],
      ['e2e/c.spec.ts', 5],
      ['e2e/d.spec.ts', 4],
    ]);
    const plan = planOf(files, times, 2);
    expect(plan).toEqual({
      parts: 2,
      files: {
        'e2e/a.spec.ts': 1,
        'e2e/b.spec.ts': 2,
        'e2e/c.spec.ts': 2,
        'e2e/d.spec.ts': 1,
      },
    });
    expect(loadOf(plan, times)).toEqual([14, 12]);
    // The same times give the same plan.
    expect(planOf([...files].reverse(), times, 2)).toEqual(plan);
  });

  it('let a file without a time cost the mean of the others', () => {
    const times = new Map([
      ['e2e/a.spec.ts', 10],
      ['e2e/b.spec.ts', 2],
    ]);
    const plan = planOf(
      ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/x.spec.ts'],
      times,
      2,
    );
    expect(plan.files['e2e/a.spec.ts']).toBe(1);
    expect(plan.files['e2e/x.spec.ts']).toBe(2);
    expect(plan.files['e2e/b.spec.ts']).toBe(2);
  });

  it('read the time of every spec file from a JSON report of Playwright', () => {
    const report = {
      suites: [
        {
          file: 'a.spec.ts',
          specs: [
            {
              tests: [
                { results: [{ duration: 100 }] },
                { results: [{ duration: 50 }] },
              ],
            },
          ],
          suites: [
            {
              specs: [
                { tests: [{ results: [{ duration: 25 }, { duration: 5 }] }] },
              ],
            },
          ],
        },
        { file: 'b.spec.ts', specs: [{ tests: [{ results: [{}] }] }] },
      ],
    };
    expect([...timesOf(report)]).toEqual([
      ['e2e/a.spec.ts', 180],
      ['e2e/b.spec.ts', 0],
    ]);
    expect([...timesOf({})]).toEqual([]);
  });

  it('are the matrix of ci.yml, and one job „E2E tests (browser)“ needs them all', () => {
    expect(CI).toContain(
      `        part: [${Array.from({ length: PARTS }, (_, i) => i + 1).join(', ')}]`,
    );
    expect(CI).toContain('node scripts/e2e-shards.ts files "$PART"');
    expect(CI).toMatch(
      /\n {2}e2e:\n {4}name: E2E tests \(browser\)\n {4}needs: \[changes, e2e-part\]\n/,
    );
    expect(existsSync(PLAN_FILE)).toBe(true);
  });
});
