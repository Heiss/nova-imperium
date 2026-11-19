import { describe, expect, it } from 'vitest';
import {
  check,
  checkTotal,
  failures,
  floorOf,
  partialProblems,
  reportPath,
  score,
  scoresOf,
  type Standard,
  table,
  totalOf,
  update,
  withoutMutants,
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

  describe('the report of a partial run (#309)', () => {
    const report = {
      config: { mutate: ['src/core/a.ts', 'src/core/types.ts'] },
      files: { 'src/core/a.ts': { mutants: m('Killed') } },
    };

    it('is the report of exactly the files of the run, in any order', () => {
      expect(
        partialProblems(['src/core/a.ts', 'src/core/types.ts'], report),
      ).toEqual([]);
      expect(
        partialProblems(['src/core/types.ts', 'src/core/a.ts'], report),
      ).toEqual([]);
    });

    it('fails when Stryker ran other files, fewer, more or none known', () => {
      const other =
        'Stryker ran [src/core/a.ts, src/core/types.ts], not the files of the partial run';
      expect(partialProblems(['src/core/a.ts'], report)).toEqual([other]);
      expect(
        partialProblems(
          ['src/core/a.ts', 'src/core/types.ts', 'src/core/b.ts'],
          report,
        ),
      ).toEqual([other]);
      expect(
        partialProblems(['src/core/a.ts', 'src/core/b.ts'], report),
      ).toEqual([other]);
      const unknown =
        'Stryker ran an unknown list of files, not the files of the partial run';
      for (const config of [undefined, {}, { mutate: 'src/core/a.ts' }])
        expect(
          partialProblems(['src/core/a.ts'], { ...report, config }),
        ).toEqual([unknown]);
    });

    it('fails when the report holds a file that is not in the run', () => {
      const foreign = {
        config: { mutate: ['src/core/a.ts'] },
        files: {
          'src/core/a.ts': { mutants: m('Killed') },
          'src/core/b.ts': { mutants: m('Killed') },
        },
      };
      expect(partialProblems(['src/core/a.ts'], foreign)).toEqual([
        'src/core/b.ts: in the report, not in the partial run',
      ]);
    });

    it('leaves out a file without mutants: Stryker does not report it', () => {
      expect(
        withoutMutants(
          ['src/core/a.ts', 'src/core/types.ts', 'toString'],
          report,
        ),
      ).toEqual(['src/core/types.ts', 'toString']);
      expect(withoutMutants(['src/core/a.ts'], report)).toEqual([]);
      expect(withoutMutants([], report)).toEqual([]);
    });
  });

  describe('failures', () => {
    const files = {
      'src/core/a.ts': { mutants: m('Killed', 'Survived') },
      'src/core/b.ts': { mutants: m('Killed', 'Killed') },
      'src/core/c.ts': { mutants: m('Killed', 'Survived', 'Survived') },
    };
    const report = { files };
    const ranAll = Object.keys(files);
    const only = (...names: (keyof typeof files)[]) =>
      Object.fromEntries(names.map((n) => [n, files[n]]));
    const made = (list: string[], kept: Record<string, unknown> = files) => ({
      config: { mutate: list },
      files: kept as typeof files,
    });

    it('checks the total and every floor of a complete report', () => {
      expect(failures(report, standard, 80)).toEqual([
        '::error::Total mutation score below the break threshold: 57.14 % < 80 % (break threshold of stryker.config.json)',
        '::error::Mutation score below the floor: src/core/a.ts: 50 % < 70 % (recorded floor)',
        '::error::Mutation score below the floor: src/core/c.ts: 33.33 % < 80 % (new file)',
      ]);
      expect(failures(report, standard, null)).toHaveLength(2);
      expect(failures({ files: {} }, standard, 80)).toEqual([]);
    });

    it('checks no total in a partial run, only the floors', () => {
      expect(failures(made(ranAll), standard, 80, ranAll)).toEqual([
        '::error::Mutation score below the floor: src/core/a.ts: 50 % < 70 % (recorded floor)',
        '::error::Mutation score below the floor: src/core/c.ts: 33.33 % < 80 % (new file)',
      ]);
      const good = made(['src/core/b.ts'], only('src/core/b.ts'));
      expect(failures(good, standard, 80, ['src/core/b.ts'])).toEqual([]);
      expect(failures(good, standard, 99, ['src/core/b.ts'])).toEqual([]);
    });

    it('accepts a file of the run without mutants', () => {
      const run = ['src/core/b.ts', 'src/core/types.ts'];
      const good = made(run, only('src/core/b.ts'));
      expect(failures(good, standard, 80, run)).toEqual([]);
    });

    it('fails a partial run whose report is not the one of its files', () => {
      expect(
        failures(made(['src/core/b.ts']), standard, 80, ['src/core/b.ts']),
      ).toContain(
        '::error::Report of the partial run: src/core/a.ts: in the report, not in the partial run',
      );
      expect(failures(made(ranAll), standard, 80, ['src/core/b.ts'])[0]).toBe(
        '::error::Report of the partial run: Stryker ran [src/core/a.ts, src/core/b.ts, src/core/c.ts], not the files of the partial run',
      );
    });

    it('checks a new file of a partial run against 80 % and a new security file against 90 %', () => {
      const scored = {
        'src/core/new.ts': {
          mutants: m(
            ...Array(79).fill('Killed'),
            ...Array(21).fill('Survived'),
          ),
        },
        'src/server/new-secret.ts': {
          mutants: m(
            ...Array(89).fill('Killed'),
            ...Array(11).fill('Survived'),
          ),
        },
      };
      const run = Object.keys(scored);
      expect(
        failures({ config: { mutate: run }, files: scored }, standard, 80, run),
      ).toEqual([
        '::error::Mutation score below the floor: src/core/new.ts: 79 % < 80 % (new file)',
        '::error::Mutation score below the floor: src/server/new-secret.ts: 89 % < 90 % (new security file)',
      ]);
    });
  });
});
