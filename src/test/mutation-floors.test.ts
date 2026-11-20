// scripts/mutation-floors.ts: the floors come from the merged report of a
// complete CI run (#304, owner, 2026-11-19).
import { describe, expect, it, vi } from 'vitest';
import { formatFloors } from '../../scripts/mutation-floorfile.ts';
import type { Standard } from '../../scripts/mutation-gate.ts';
import {
  logScores,
  main,
  raise,
  reportProblem,
  summary,
  type Deps,
} from '../../scripts/mutation-floors.ts';

const m = (...statuses: string[]) => statuses.map((status) => ({ status }));

const standard: Standard = {
  securityTarget: 90,
  newFile: 80,
  security: ['src/server/auth.ts', 'src/server/new-secret.ts'],
  floors: {
    'src/core/a.ts': 70,
    'src/core/b.ts': 85,
    'src/core/gone.ts': 60,
    'src/core/no-mutants.ts': 50,
    'src/server/auth.ts': 83.75,
  },
};
const everything = () => true;

describe('the report the floors come from', () => {
  it('is the merged report of a complete run: no config, no test files', () => {
    expect(reportProblem({ files: {}, thresholds: {} })).toBeUndefined();
    expect(
      reportProblem({ files: { 'a.ts': { mutants: [] } } }),
    ).toBeUndefined();
  });

  it('is not the report of one Stryker run, local or partial', () => {
    for (const single of [{ config: {} }, { testFiles: {} }])
      expect(reportProblem({ files: {}, ...single })).toBe(
        'The report is the one of a single Stryker run (it has "config" or "testFiles"), not the merged report of a complete CI run. Floors come from the artifact "mutation-report" only (#304).',
      );
  });

  it('is a report with files', () => {
    for (const bad of [null, 'x', 3, {}, { files: 'x' }, []])
      expect(reportProblem(bad)).toBe(
        'The file is no mutation report (no "files").',
      );
  });
});

describe('the scores in the log of the gate step', () => {
  const stamp = '2026-11-19T22:51:32.6528902Z ';
  const line = (file: string, score: string) =>
    `${stamp}${file}: ${score} % (killed 9, timeout 1, survived 2, no coverage 0, errors 3)`;
  const log = [
    `${stamp}##[group]Run node scripts/mutation-gate.ts --report reports/mutation/mutation.json`,
    line('src/core/a.ts', '93.44'),
    line('src/core/b.ts', '100'),
    `${stamp}::notice file=src/server/auth.ts::src/server/auth.ts: 85 % of the 90 % target for security files`,
    `${stamp}Total mutation score: 91.2 %`,
    `${stamp}::error::Mutation score below the floor: src/core/c.ts: 69 % < 70 % (recorded floor)`,
  ].join('\n');

  it('are read from the table with its time stamps, whatever the gate said after it', () => {
    expect(logScores(log)).toEqual({
      'src/core/a.ts': 93.44,
      'src/core/b.ts': 100,
    });
    // A line without a time stamp, and the CRLF of a downloaded log.
    expect(
      logScores(
        'src/core/a.ts: 50 % (killed 1, timeout 0, survived 1, no coverage 0, errors 0)\r\nTotal mutation score: 50 %\r\n',
      ),
    ).toEqual({ 'src/core/a.ts': 50 });
  });

  it('are refused from a partial run, a log without the table and two scores for a file', () => {
    expect(() =>
      logScores(
        `${log}\n${stamp}Partial run of 3 files: no total score, every file against its floor.`,
      ),
    ).toThrow('the one of a partial run');
    expect(() => logScores('nothing\nTotal mutation score: 5 %')).toThrow(
      'no log of the gate step of a complete run',
    );
    expect(() => logScores(line('src/core/a.ts', '50'))).toThrow(
      'no log of the gate step of a complete run',
    );
    expect(() =>
      logScores(`${log}\n${line('src/core/a.ts', '93.45')}`),
    ).toThrow('The log has two scores for src/core/a.ts.');
    // The same score twice is the same log twice, no problem.
    expect(logScores(`${log}\n${line('src/core/a.ts', '93.44')}`)).toEqual({
      'src/core/a.ts': 93.44,
      'src/core/b.ts': 100,
    });
  });
});

describe('raising the floors to a report', () => {
  it('adds the measured score of a file without a floor, rounded down to two decimals', () => {
    // 2 of 3 killed: 66.666 -> 66.66, as the gate counts it.
    const found = raise(
      { 'src/core/new.ts': 85.71, 'src/core/a.ts': 70 },
      standard,
      everything,
    );
    expect(found.added).toEqual([{ file: 'src/core/new.ts', to: 85.71 }]);
    expect(found.floors['src/core/new.ts']).toBe(85.71);
    expect(found.below).toEqual([]);
  });

  it('raises the floor of a file that scores higher, and keeps an equal one', () => {
    const found = raise(
      {
        'src/core/a.ts': 91.2,
        'src/core/b.ts': 85,
        'src/server/auth.ts': 83.75,
      },
      standard,
      everything,
    );
    expect(found.raised).toEqual([
      { file: 'src/core/a.ts', from: 70, to: 91.2 },
    ]);
    expect(found.floors['src/core/a.ts']).toBe(91.2);
    expect(found.floors['src/core/b.ts']).toBe(85);
    expect(found.floors['src/server/auth.ts']).toBe(83.75);
    expect(found.added).toEqual([]);
  });

  it('never lowers a floor: a file below its floor stops everything and is listed', () => {
    const found = raise(
      {
        'src/core/a.ts': 69.99,
        'src/core/b.ts': 100,
        'src/core/c.ts': 99,
        'src/server/auth.ts': 80,
      },
      standard,
      everything,
    );
    expect(found.below).toEqual([
      'src/core/a.ts: 69.99 % < 70 % (recorded floor)',
      'src/server/auth.ts: 80 % < 83.75 % (recorded floor)',
    ]);
    // Nothing is raised or added alongside: the floors stay as they were.
    expect(found.floors).toEqual(standard.floors);
    expect(found.raised).toEqual([]);
    expect(found.added).toEqual([]);
  });

  it('writes no floor below the minimum of a new file or a new security file', () => {
    const found = raise(
      { 'src/core/new.ts': 79.99, 'src/server/new-secret.ts': 89.99 },
      standard,
      everything,
    );
    expect(found.below).toEqual([
      'src/core/new.ts: 79.99 % < 80 % (new file)',
      'src/server/new-secret.ts: 89.99 % < 90 % (new security file)',
    ]);
    const exact = raise(
      { 'src/core/new.ts': 80, 'src/server/new-secret.ts': 90 },
      standard,
      everything,
    );
    expect(exact.below).toEqual([]);
    expect(exact.added.map((c) => c.file)).toEqual([
      'src/core/new.ts',
      'src/server/new-secret.ts',
    ]);
  });

  it('drops the floor of a file that is gone and adds none for it', () => {
    const exists = (file: string) =>
      file !== 'src/core/gone.ts' && file !== 'src/core/deleted.ts';
    const found = raise(
      { 'src/core/a.ts': 70, 'src/core/deleted.ts': 99 },
      standard,
      exists,
    );
    expect(found.removed).toEqual(['src/core/gone.ts']);
    expect(Object.keys(found.floors)).not.toContain('src/core/gone.ts');
    expect(Object.keys(found.floors)).not.toContain('src/core/deleted.ts');
    expect(found.added).toEqual([]);
  });

  it('keeps the floor of a file the report leaves out (no mutants) while the file exists', () => {
    const found = raise({ 'src/core/a.ts': 70 }, standard, everything);
    expect(found.floors['src/core/no-mutants.ts']).toBe(50);
    expect(found.removed).toEqual([]);
  });

  it('leaves the standard it was given as it was', () => {
    const before = JSON.stringify(standard);
    raise({ 'src/core/a.ts': 99 }, standard, everything);
    expect(JSON.stringify(standard)).toBe(before);
  });

  it('names what changed, and says when nothing is written', () => {
    const found = raise(
      { 'src/core/new.ts': 90, 'src/core/a.ts': 75 },
      standard,
      (file) => file !== 'src/core/gone.ts',
    );
    expect(summary(found, false)).toEqual([
      'added   src/core/new.ts: 90 %',
      'raised  src/core/a.ts: 70 % -> 75 %',
      'removed src/core/gone.ts: the file is gone',
      'Floors: 1 added, 1 raised, 1 removed.',
    ]);
    expect(summary(found, true).at(-1)).toBe(
      'Floors: 1 added, 1 raised, 1 removed (--dry-run: nothing written).',
    );
  });
});

describe('mutation-floors.ts', () => {
  const config = JSON.stringify({
    securityTarget: 90,
    newFile: 80,
    security: [],
  });
  const floorsText =
    'src/core/a.ts 70\nsrc/core/b.ts 85\nsrc/core/gone.ts 60\n';
  /** The merged report: a has 3 of 4 killed (75), c is new with 5 of 6 killed. */
  const report = {
    thresholds: { high: 90, low: 80, break: 80 },
    files: {
      'src/core/a.ts': {
        mutants: m('Killed', 'Timeout', 'Killed', 'Survived', 'Ignored'),
      },
      'src/core/b.ts': { mutants: m('Killed', 'Killed', 'Killed') },
      'src/core/c.ts': {
        mutants: m(
          'Killed',
          'Killed',
          'Killed',
          'Killed',
          'Killed',
          'Survived',
        ),
      },
      'src/core/types.ts': { mutants: [] },
    },
  };

  const world = (over: Partial<Deps> = {}, text = JSON.stringify(report)) => {
    const files: Record<string, string> = {
      'report.json': text,
      'mutation-standard.json': config,
      'mutation-floors.txt': floorsText,
    };
    const writes: Record<string, string> = {};
    const out: string[] = [];
    const deps: Partial<Deps> = {
      read: (file) => {
        const found = files[file];
        if (found === undefined) throw new Error(`no ${file}`);
        return found;
      },
      write: (file, content) => {
        writes[file] = content;
      },
      exists: (file) => file !== 'src/core/gone.ts',
      mutated: () => [],
      log: (line) => out.push(line),
      ...over,
    };
    return { deps, writes, out, files };
  };

  it('writes the floors of the report: added, raised, removed, sorted', () => {
    const { deps, writes, out } = world();
    expect(main(['report.json'], deps)).toBe(0);
    expect(writes).toEqual({
      'mutation-floors.txt':
        'src/core/a.ts 75\nsrc/core/b.ts 100\nsrc/core/c.ts 83.33\n',
    });
    expect(out).toContain('added   src/core/c.ts: 83.33 %');
    expect(out).toContain('raised  src/core/a.ts: 70 % -> 75 %');
    expect(out).toContain('removed src/core/gone.ts: the file is gone');
  });

  it('refuses a new file below the minimum of a new file and writes nothing', () => {
    // c scores 66.66 against the 80 of a new file: the CI gate failed on it.
    const { deps, writes, out } = world(
      {},
      JSON.stringify({
        files: {
          'src/core/c.ts': { mutants: m('Killed', 'Killed', 'Survived') },
        },
      }),
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(main(['report.json'], deps)).toBe(1);
      expect(error).toHaveBeenCalledWith(
        '1 files are below their floor in the report. A floor never goes down: raise their tests, or remove the change that lowered them. Nothing was written.',
      );
    } finally {
      error.mockRestore();
    }
    expect(writes).toEqual({});
    expect(out).toEqual([
      'below its floor: src/core/c.ts: 66.66 % < 80 % (new file)',
    ]);
  });

  it('refuses a file below its floor and writes nothing, not even the other files', () => {
    const lower = {
      files: {
        'src/core/a.ts': { mutants: m('Killed', 'Survived') },
        'src/core/b.ts': report.files['src/core/b.ts'],
      },
    };
    const { deps, writes, out } = world({}, JSON.stringify(lower));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(main(['report.json'], deps)).toBe(1);
    } finally {
      error.mockRestore();
    }
    expect(writes).toEqual({});
    expect(out).toEqual([
      'below its floor: src/core/a.ts: 50 % < 70 % (recorded floor)',
    ]);
  });

  it('writes nothing with --dry-run', () => {
    const { deps, writes, out } = world();
    expect(main(['report.json', '--dry-run'], deps)).toBe(0);
    expect(writes).toEqual({});
    expect(out.at(-1)).toBe(
      'Floors: 1 added, 2 raised, 1 removed (--dry-run: nothing written).',
    );
  });

  it('writes the floors of a gate log with --log, with the same rules', () => {
    const log = [
      'src/core/a.ts: 75 % (killed 3, timeout 0, survived 1, no coverage 0, errors 0)',
      'src/core/c.ts: 83.33 % (killed 5, timeout 0, survived 1, no coverage 0, errors 0)',
      'Total mutation score: 80 %',
    ].join('\n');
    const { deps, writes, out } = world({}, log);
    expect(main(['--log', 'report.json'], deps)).toBe(0);
    expect(writes).toEqual({
      'mutation-floors.txt':
        'src/core/a.ts 75\nsrc/core/b.ts 85\nsrc/core/c.ts 83.33\n',
    });
    expect(out).toContain('added   src/core/c.ts: 83.33 %');
    const low = world({}, log.replace('75 %', '60 %'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(main(['--log', 'report.json'], low.deps)).toBe(1);
    } finally {
      error.mockRestore();
    }
    expect(low.writes).toEqual({});
    expect(() =>
      main(['--log', 'report.json'], world({}, '{"files":{}}').deps),
    ).toThrow('no log of the gate step');
  });

  it('refuses the report of a single Stryker run', () => {
    const { deps, writes } = world(
      {},
      JSON.stringify({ ...report, config: { mutate: ['src/core/a.ts'] } }),
    );
    expect(() => main(['report.json'], deps)).toThrow(
      'not the merged report of a complete CI run',
    );
    expect(writes).toEqual({});
  });

  it('refuses a floors file with two lines for a file', () => {
    const { deps, writes, files } = world();
    files['mutation-floors.txt'] = 'src/core/a.ts 70\nsrc/core/a.ts 72\n';
    expect(() => main(['report.json'], deps)).toThrow('has two floors');
    expect(writes).toEqual({});
  });

  it('notices a mutated file that is neither in the report nor has a floor', () => {
    const { deps, out } = world({
      mutated: () => [
        'src/core/a.ts',
        'src/core/types.ts',
        'src/core/newer.ts',
      ],
    });
    main(['report.json'], deps);
    expect(out).toContain(
      'Notice: 2 mutated files of this tree are not in the report (no mutants, or newer than the run): src/core/types.ts, src/core/newer.ts',
    );
    const quiet = world();
    main(['report.json'], quiet.deps);
    expect(quiet.out.some((l) => l.startsWith('Notice'))).toBe(false);
  });

  it('writes the floors file in its form with --format, and refuses a duplicate', () => {
    const { deps, writes, files } = world();
    files['mutation-floors.txt'] = 'src/core/b.ts 85\nsrc/core/a.ts 70';
    expect(main(['--format'], deps)).toBe(0);
    expect(writes).toEqual({
      'mutation-floors.txt': formatFloors({
        'src/core/a.ts': 70,
        'src/core/b.ts': 85,
      }),
    });
    files['mutation-floors.txt'] = 'src/core/a.ts 70\nsrc/core/a.ts 70\n';
    expect(() => main(['--format'], deps)).toThrow('has two floors');
  });

  it('wants one report and knows no other flag', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const args of [[], ['a.json', 'b.json'], ['a.json', '--update']])
        expect(main(args, world().deps)).toBe(1);
      expect(error).toHaveBeenCalledWith(
        'Usage: mutation-floors.ts <report.json> [--dry-run] | --log <gate.log> [--dry-run] | --format',
      );
    } finally {
      error.mockRestore();
    }
  });
});
