// The lookup of the last nightly complete mutation run on main (#370).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type Api,
  check,
  lastNightly,
  main,
  NIGHTLY,
  type NightlyRun,
  verdictOf,
} from '../../scripts/mutation-nightly.ts';

const REPO = 'owner/game';

/** A completed green nightly run of the repository on main. */
const run = (fields: Partial<NightlyRun> = {}): NightlyRun => ({
  id: 100,
  path: NIGHTLY,
  event: 'schedule',
  status: 'completed',
  conclusion: 'success',
  head_branch: 'main',
  html_url: `https://github.com/${REPO}/actions/runs/100`,
  repository: { full_name: REPO },
  ...fields,
});

/** An API that answers the list of runs with <runs> and records the paths. */
function apiOf(runs: unknown): { api: Api; paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    api: (path) => {
      paths.push(path);
      return { workflow_runs: runs };
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('lastNightly', () => {
  it('takes the newest completed run, not the first of the list', () => {
    const runs = [run({ id: 5 }), run({ id: 9, conclusion: 'failure' })];
    expect(lastNightly(REPO, runs)?.id).toBe(9);
    expect(lastNightly(REPO, [...runs].reverse())?.id).toBe(9);
  });

  it('skips a cancelled run and one still going: the newest completed decides', () => {
    const runs = [
      run({ id: 5, conclusion: 'failure' }),
      run({ id: 7, conclusion: 'cancelled' }),
      run({ id: 8, status: 'in_progress', conclusion: null }),
    ];
    expect(lastNightly(REPO, runs)?.id).toBe(5);
  });

  it.each([
    ['another workflow', { path: '.github/workflows/ci.yml' }],
    ['a dispatched run', { event: 'workflow_dispatch' }],
    ['another branch', { head_branch: 'claude/x' }],
    ['a run of a fork', { repository: { full_name: 'fork/game' } }],
    ['a run without repository', { repository: null }],
  ])('does not count %s', (_, fields: Partial<NightlyRun>) => {
    expect(lastNightly(REPO, [run({ id: 9, ...fields })])).toBeUndefined();
    expect(
      lastNightly(REPO, [run({ id: 3 }), run({ id: 9, ...fields })])?.id,
    ).toBe(3);
  });
});

describe('verdictOf', () => {
  it('is green only for a run that succeeded, and names it', () => {
    expect(verdictOf(run())).toEqual({
      green: true,
      line: `nightly mutation run 100 on main: success (https://github.com/${REPO}/actions/runs/100)`,
    });
  });

  it.each(['failure', 'timed_out', 'skipped', 'neutral', null])(
    'is red for the conclusion %s',
    (conclusion) => {
      const v = verdictOf(run({ conclusion }));
      expect(v.green).toBe(false);
      expect(v.line).toBe(
        `nightly mutation run 100 on main: ${conclusion ?? 'no conclusion'} (https://github.com/${REPO}/actions/runs/100): the complete run`,
      );
    },
  );

  it('is red without a run', () => {
    expect(verdictOf(undefined)).toEqual({
      green: false,
      line: 'no completed nightly mutation run on main: the complete run',
    });
  });
});

describe('check', () => {
  it('asks for the completed scheduled runs of mutation.yml on main', () => {
    const { api, paths } = apiOf([run()]);
    expect(check(REPO, api).green).toBe(true);
    expect(paths).toEqual([
      `repos/${REPO}/actions/workflows/mutation.yml/runs?branch=main&event=schedule&status=completed&per_page=100`,
    ]);
  });

  it('is red when the newest run failed', () => {
    const { api } = apiOf([run(), run({ id: 101, conclusion: 'failure' })]);
    expect(check(REPO, api).green).toBe(false);
  });

  it('counts every error of the lookup as missing', () => {
    const broken: Api = () => {
      throw new Error('HTTP 403');
    };
    expect(check(REPO, broken)).toEqual({
      green: false,
      line: 'cannot look up the nightly mutation run (HTTP 403): the complete run',
    });
    for (const answer of [null, {}, { workflow_runs: 'x' }]) {
      const v = check(REPO, () => answer);
      expect(v.green).toBe(false);
      expect(v.line).toBe(
        'cannot look up the nightly mutation run (no list of workflow runs in the answer): the complete run',
      );
    }
    expect(check(REPO, () => 'text').green).toBe(false);
  });
});

describe('main', () => {
  it('prints the verdict and the line, the line on stderr too', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main(apiOf([run()]).api, ['check'], REPO)).toBe(0);
    const line = `nightly mutation run 100 on main: success (https://github.com/${REPO}/actions/runs/100)`;
    expect(out.mock.calls).toEqual([['green'], [line]]);
    expect(err.mock.calls).toEqual([[line]]);
  });

  it('prints red without a repository and asks nothing', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { api, paths } = apiOf([run()]);
    expect(main(api, ['check'], undefined)).toBe(0);
    expect(out.mock.calls).toEqual([
      ['red'],
      ['GITHUB_REPOSITORY names no repository: the complete run'],
    ]);
    expect(paths).toEqual([]);
  });

  it('keeps the line on one line', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: Api = () => {
      throw new Error('a\nb\rc');
    };
    main(broken, ['check'], REPO);
    expect(out.mock.calls[1]![0]).toBe(
      'cannot look up the nightly mutation run (a b c): the complete run',
    );
  });

  it('refuses another command', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main(apiOf([]).api, ['decide'], REPO)).toBe(1);
    expect(main(apiOf([]).api, [], REPO)).toBe(1);
    expect(err).toHaveBeenCalledWith('Usage: mutation-nightly.ts check');
  });
});
