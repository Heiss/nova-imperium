import { describe, expect, it } from 'vitest';
import {
  check,
  checkTotal,
  floorOf,
  reportPath,
  score,
  scoresOf,
  type Standard,
  table,
  totalOf,
  update,
} from '../../scripts/mutation-gate.ts';

const m = (...statuses: string[]) => statuses.map((status) => ({ status }));

const standard: Standard = {
  securityTarget: 90,
  newFile: 80,
  security: ['src/server/auth.ts', 'src/server/new-secret.ts'],
  floors: { 'src/server/auth.ts': 83.75, 'src/core/a.ts': 70 },
};

describe('mutation gate', () => {
  it('scores like Stryker: killed and timeout count, errors and ignored not', () => {
    expect(score(m('Killed', 'Timeout', 'Survived', 'NoCoverage'))).toBe(50);
    expect(
      score(m('Killed', 'CompileError', 'RuntimeError', 'Ignored', 'Pending')),
    ).toBe(100);
    expect(score(m('Killed', 'Killed', 'Survived'))).toBe(66.66);
    expect(score(m('CompileError'))).toBeNull();
    expect(score([])).toBeNull();
  });

  it('takes the recorded floor, else the target of a new file', () => {
    expect(floorOf('src/server/auth.ts', standard)).toEqual({
      min: 83.75,
      why: 'recorded floor',
    });
    expect(floorOf('src/server/new-secret.ts', standard)).toEqual({
      min: 90,
      why: 'new security file',
    });
    expect(floorOf('src/core/b.ts', standard)).toEqual({
      min: 80,
      why: 'new file',
    });
  });

  it('fails only files below their floor; equal passes', () => {
    expect(
      check(
        {
          'src/server/auth.ts': 83.75,
          'src/core/a.ts': 69.99,
          'src/server/new-secret.ts': 89.99,
          'src/core/b.ts': 80,
        },
        standard,
      ),
    ).toEqual([
      'src/core/a.ts: 69.99 % < 70 % (recorded floor)',
      'src/server/new-secret.ts: 89.99 % < 90 % (new security file)',
    ]);
  });

  it('raises floors, never lowers them, and drops files that no longer exist', () => {
    const next = update(
      {
        'src/server/auth.ts': 91,
        'src/core/a.ts': 60,
        'src/core/c.ts': 85,
      },
      standard,
    );
    expect(next.floors).toEqual({
      'src/server/auth.ts': 91,
      'src/core/a.ts': 70,
      'src/core/c.ts': 85,
    });
    expect(Object.keys(next.floors)).toEqual(
      [...Object.keys(next.floors)].sort(),
    );
    expect(next.security).toEqual(standard.security);
    const exists = (file: string) => file !== 'src/core/a.ts';
    expect(
      update({ 'src/server/auth.ts': 80 }, standard, exists).floors,
    ).toEqual({ 'src/server/auth.ts': 83.75 });
    expect(standard.floors['src/server/auth.ts']).toBe(83.75);
  });

  it('keeps the floor of a file left out of a partial run', () => {
    expect(
      update({ 'src/server/auth.ts': 85 }, standard, () => true).floors,
    ).toEqual({ 'src/server/auth.ts': 85, 'src/core/a.ts': 70 });
  });

  it('skips files without counted mutants', () => {
    expect(
      scoresOf({
        files: {
          'src/core/types.ts': { mutants: [] },
          'src/core/a.ts': { mutants: m('Killed', 'Survived') },
        },
      }),
    ).toEqual({ 'src/core/a.ts': 50 });
  });

  it('scores the total over all files, as Stryker counts "All files"', () => {
    const merged = {
      files: {
        'src/core/a.ts': { mutants: m('Killed', 'Survived', 'Ignored') },
        'src/core/b.ts': { mutants: m('Timeout', 'Killed', 'NoCoverage') },
        'src/core/types.ts': { mutants: [] },
      },
    };
    expect(totalOf(merged)).toBe(60);
    expect(totalOf({ files: {} })).toBeNull();
  });

  it('fails a total below the break threshold; equal passes, null checks nothing', () => {
    expect(checkTotal(79.99, 80)).toEqual([
      '79.99 % < 80 % (break threshold of stryker.config.json)',
    ]);
    expect(checkTotal(80, 80)).toEqual([]);
    expect(checkTotal(null, 80)).toEqual([]);
    expect(checkTotal(10, null)).toEqual([]);
  });

  it('reads the report after --report, else the one Stryker writes', () => {
    expect(reportPath([])).toBe('reports/mutation/mutation.json');
    expect(reportPath(['--update'])).toBe('reports/mutation/mutation.json');
    expect(reportPath(['--report', 'merged.json'])).toBe('merged.json');
    expect(reportPath(['--update', '--report', 'm.json'])).toBe('m.json');
    expect(() => reportPath(['--report'])).toThrow(
      '--report needs the path of a report.',
    );
    expect(() => reportPath(['--report', '--update'])).toThrow(
      '--report needs the path of a report.',
    );
  });

  it('lists every file with its counts, sorted', () => {
    expect(
      table({
        files: {
          'src/core/b.ts': {
            mutants: m(
              'Killed',
              'Timeout',
              'Survived',
              'NoCoverage',
              'CompileError',
              'RuntimeError',
              'Ignored',
            ),
          },
          'src/core/a.ts': { mutants: [] },
        },
      }),
    ).toEqual([
      'src/core/a.ts: - % (killed 0, timeout 0, survived 0, no coverage 0, errors 0)',
      'src/core/b.ts: 50 % (killed 1, timeout 1, survived 1, no coverage 1, errors 2)',
    ]);
  });
});
