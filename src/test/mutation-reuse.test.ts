import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHECK,
  checkRuns,
  type CheckRun,
  decide,
  main,
  mergeOfMain,
  mergeReasons,
  notGreen,
  verify,
} from '../../scripts/mutation-reuse.ts';

const REPO = 'owner/game';

/** A check run of the REST API. */
const run = (fields: Partial<CheckRun> = {}): CheckRun => ({
  id: 1,
  name: CHECK,
  status: 'completed',
  conclusion: 'success',
  app: { slug: 'github-actions' },
  ...fields,
});

/** A command with fixed answers; one it does not know fails. */
const fake =
  (answers: Record<string, string>) =>
  (args: string[]): string => {
    const answer = answers[args.join(' ')];
    if (answer === undefined) throw new Error(`unknown: ${args.join(' ')}`);
    return answer;
  };

const runsCall = (sha: string): string =>
  `api --method GET repos/${REPO}/commits/${sha}/check-runs -f check_name=${CHECK} -f filter=all -f per_page=100`;
const runsAnswer = (...runs: CheckRun[]): string =>
  JSON.stringify({ total_count: runs.length, check_runs: runs });

describe('mutation reuse: the earlier result', () => {
  it('needs the newest "Mutation tests" of GitHub Actions to be green', () => {
    expect(notGreen('p1', [run()])).toBeUndefined();
    // A re-run gets a higher id: the newest one decides, in any order.
    const failed = run({ id: 1, conclusion: 'failure' });
    expect(notGreen('p1', [failed, run({ id: 2 })])).toBeUndefined();
    expect(notGreen('p1', [run({ id: 2 }), failed])).toBeUndefined();
  });

  it('refuses a newer run that is not green', () => {
    for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral']) {
      const newer = run({ id: 2, conclusion });
      const message = `the newest check run "${CHECK}" of p1 is ${conclusion}`;
      expect(notGreen('p1', [run({ id: 1 }), newer])).toBe(message);
      expect(notGreen('p1', [newer, run({ id: 1 })])).toBe(message);
    }
    expect(
      notGreen('p1', [
        run({ id: 1 }),
        run({ id: 2, status: 'in_progress', conclusion: null }),
      ]),
    ).toBe(`the newest check run "${CHECK}" of p1 is in_progress`);
    expect(
      notGreen('p1', [run({ status: 'queued', conclusion: 'success' })]),
    ).toBe(`the newest check run "${CHECK}" of p1 is success`);
  });

  it('counts only the job "Mutation tests" of GitHub Actions', () => {
    const none = `p1 has no check run "${CHECK}"`;
    expect(notGreen('p1', [])).toBe(none);
    expect(notGreen('p1', [run({ name: `${CHECK} (shard 1 of 6)` })])).toBe(
      none,
    );
    expect(notGreen('p1', [run({ name: `${CHECK} (complete)` })])).toBe(none);
    expect(notGreen('p1', [run({ app: { slug: 'other-app' } })])).toBe(none);
    expect(notGreen('p1', [run({ app: null })])).toBe(none);
  });

  it('names the gate job of the mutation run in ci.yml', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain(`\n  mutation:\n    name: ${CHECK}\n`);
  });

  it('reads the check runs of a commit through gh', () => {
    const gh = fake({ [runsCall('p1')]: runsAnswer(run()) });
    expect(checkRuns('p1', REPO, gh)).toEqual([run()]);
    expect(() =>
      checkRuns('p1', REPO, fake({ [runsCall('p1')]: '{}' })),
    ).toThrow('no check runs in the answer for p1');
  });
});

describe('mutation reuse: the files of the merge', () => {
  it('takes over when the merge leaves the pull request, the tests and the configuration alone', () => {
    expect(
      mergeReasons(
        ['README.md', 'src/core/economy.ts', 'Dockerfile', 'e2e/game.spec.ts'],
        ['src/core/fleet.ts', 'src/core/fleet.test.ts', 'okf/log.md'],
      ),
    ).toEqual([]);
    expect(mergeReasons([], ['src/core/fleet.ts'])).toEqual([]);
  });

  it('names a file of the pull request, a test file and the configuration', () => {
    expect(
      mergeReasons(
        [
          'okf/log.md',
          'src/core/economy.test.ts',
          'src/test/fixtures.ts',
          'src/server/test-helpers.ts',
          'stryker.config.json',
          'scripts/mutation-gate.ts',
          'src/core/economy.ts',
        ],
        ['okf/log.md', 'src/core/fleet.ts'],
      ),
    ).toEqual([
      'the merge changes okf/log.md, a file of the pull request',
      'the merge changes src/core/economy.test.ts, a test file',
      'the merge changes src/test/fixtures.ts, a test file',
      'the merge changes src/server/test-helpers.ts, a test file',
      'the merge changes stryker.config.json, which configures the mutation run',
      'the merge changes scripts/mutation-gate.ts, which configures the mutation run',
    ]);
  });

  it('names a test file the pull request changes as a file of the pull request', () => {
    expect(
      mergeReasons(['src/core/fleet.test.ts'], ['src/core/fleet.test.ts']),
    ).toEqual([
      'the merge changes src/core/fleet.test.ts, a file of the pull request',
    ]);
  });
});

/**
 * A text of twelve lines: a pull request and main can change its first and
 * its last line without a conflict.
 */
const lines = (first: string, last: string): string =>
  [first, ...Array.from({ length: 10 }, (_, i) => `line ${i}`), last, ''].join(
    '\n',
  );

/** A Git repository in a temporary folder, as the CI checks it out. */
function repository() {
  const dir = mkdtempSync(join(tmpdir(), 'mutation-reuse-'));
  const git = (args: string[]): string =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.org',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.org',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    });
  const sha = (rev: string): string => git(['rev-parse', rev]).trim();
  /** Writes the files and commits them; returns the commit. */
  const commit = (files: Record<string, string>): string => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    git(['add', '-A']);
    git(['commit', '-q', '-m', Object.keys(files).join(' ')]);
    return sha('HEAD');
  };
  /** Merges <rev> into the checked-out commit; returns the merge. */
  const merge = (rev: string): string => {
    git(['merge', '-q', '--no-ff', '--no-edit', rev]);
    return sha('HEAD');
  };
  /** The merge commit GitHub tests: the head merged into the base. */
  const tested = (base: string, head: string): string => {
    git(['checkout', '-q', '--detach', base]);
    return merge(head);
  };
  git(['init', '-q', '-b', 'main']);
  commit({
    'README.md': 'game\n',
    'okf/log.md': lines('log', 'end'),
    'src/core/economy.ts': 'export const a = 1;\n',
    'src/core/economy.test.ts': 'test\n',
  });
  return { dir, git, sha, commit, merge, tested };
}

describe('mutation reuse: the history (real Git)', () => {
  const repos: string[] = [];
  afterAll(() => {
    for (const dir of repos) rmSync(dir, { recursive: true, force: true });
  });

  /**
   * A pull request with one commit on the first commit of main, then <main>
   * on main, then main merged into the pull request.
   */
  function scenario(mainFiles: Record<string, string>) {
    const r = repository();
    repos.push(r.dir);
    r.git(['checkout', '-q', '-b', 'feature']);
    const p1 = r.commit({
      'src/core/fleet.ts': 'export const f = 1;\n',
      'okf/log.md': lines('pull request', 'end'),
    });
    r.git(['checkout', '-q', 'main']);
    const base = r.commit(mainFiles);
    r.git(['checkout', '-q', 'feature']);
    const head = r.merge('main');
    return { ...r, p1, base, head };
  }

  it('takes over after a merge of main that touches other files', () => {
    const s = scenario({ 'README.md': 'game 2\n', 'src/core/economy.ts': '2' });
    expect(
      mergeOfMain(s.base, s.tested(s.base, s.head), s.head, s.git),
    ).toEqual({ parent: s.p1, reasons: [] });
  });

  it('runs the jobs when the merge changes a file of the pull request', () => {
    const s = scenario({ 'okf/log.md': lines('log', 'main') });
    expect(
      mergeOfMain(s.base, s.tested(s.base, s.head), s.head, s.git),
    ).toEqual({
      parent: s.p1,
      reasons: ['the merge changes okf/log.md, a file of the pull request'],
    });
  });

  it('runs the jobs when the merge changes a test or the configuration', () => {
    const s = scenario({
      'src/core/economy.test.ts': 'test 2\n',
      'vitest.config.ts': 'config\n',
    });
    expect(
      mergeOfMain(s.base, s.tested(s.base, s.head), s.head, s.git).reasons,
    ).toEqual([
      'the merge changes src/core/economy.test.ts, a test file',
      'the merge changes vitest.config.ts, which configures the mutation run',
    ]);
  });

  it('runs the jobs when main moved after the merge', () => {
    const s = scenario({ 'README.md': 'game 2\n' });
    s.git(['checkout', '-q', 'main']);
    const newer = s.commit({ 'docs/x.md': 'x\n' });
    const tested = s.tested(newer, s.head);
    expect(mergeOfMain(newer, tested, s.head, s.git)).toEqual({
      parent: s.p1,
      reasons: [
        `the tested commit ${tested} differs from the head ${s.head}: main moved after the merge`,
      ],
    });
  });

  it('runs the jobs when the head is no merge', () => {
    const s = scenario({ 'README.md': 'game 2\n' });
    const next = s.commit({ 'src/core/fleet.ts': 'export const f = 2;\n' });
    expect(mergeOfMain(s.base, s.tested(s.base, next), next, s.git)).toEqual({
      reasons: [`${next} is not a merge of two commits`],
    });
    expect(mergeOfMain(s.base, s.tested(s.base, s.p1), s.p1, s.git)).toEqual({
      reasons: [`${s.p1} is not a merge of two commits`],
    });
  });

  it('runs the jobs when the head merged another branch than main', () => {
    const s = scenario({ 'README.md': 'game 2\n' });
    s.git(['checkout', '-q', '-b', 'other', s.base]);
    const other = s.commit({ 'docs/other.md': 'other\n' });
    s.git(['checkout', '-q', 'feature']);
    const head = s.merge('other');
    expect(
      mergeOfMain(s.base, s.tested(s.base, head), head, s.git).reasons,
    ).toEqual([`the second parent ${other} is not a commit of main`]);
  });

  it('runs the jobs when the first parent is a commit of main', () => {
    const s = scenario({ 'README.md': 'game 2\n' });
    // The pull request merged into main instead of main into it.
    s.git(['checkout', '-q', '-B', 'feature', s.base]);
    const head = s.merge(s.p1);
    expect(
      mergeOfMain(s.base, s.tested(s.base, head), head, s.git).reasons,
    ).toEqual([
      `the second parent ${s.p1} is not a commit of main`,
      `the first parent ${s.base} is not a commit of the pull request`,
    ]);
  });
});

describe('mutation reuse: the commands', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const output = () => ({
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  });
  const diff = (from: string, to: string) =>
    `diff --name-only -z --no-renames ${from} ${to}`;
  /** A history in which head merged main (base) onto p1. */
  const history = (merged: string, changed: string) =>
    fake({
      'rev-list --parents -n 1 head': 'head p1 base\n',
      'merge-base base base': 'base\n',
      'merge-base p1 base': 'root\n',
      'rev-parse tested^{tree}': 'tree\n',
      'rev-parse head^{tree}': 'tree\n',
      [diff('p1', 'head')]: merged,
      [diff('base', 'tested')]: changed,
    });

  it('decides reuse for a merge of main after a green run', () => {
    const { error } = output();
    const git = history('README.md\0', 'src/core/fleet.ts\0');
    const gh = fake({ [runsCall('p1')]: runsAnswer(run()) });
    expect(decide(['base', 'tested', 'head'], REPO, git, gh)).toBe('reuse');
    expect(error.mock.calls).toEqual([
      [
        'The head only merged main: the mutation result of its first parent is taken over.',
      ],
    ]);
  });

  it('decides true with the reasons otherwise', () => {
    const { error } = output();
    const git = history('src/core/fleet.ts\0', 'src/core/fleet.ts\0');
    expect(decide(['base', 'tested', 'head'], REPO, git, fake({}))).toBe(
      'true',
    );
    expect(error.mock.calls).toEqual([
      [
        'Mutation jobs run: the merge changes src/core/fleet.ts, a file of the pull request',
      ],
    ]);
  });

  it('decides true when the earlier run is not green', () => {
    const { error } = output();
    const git = history('README.md\0', '');
    const gh = fake({
      [runsCall('p1')]: runsAnswer(run({ conclusion: 'cancelled' })),
    });
    expect(decide(['base', 'tested', 'head'], REPO, git, gh)).toBe('true');
    expect(error.mock.calls).toEqual([
      [`Mutation jobs run: the newest check run "${CHECK}" of p1 is cancelled`],
    ]);
  });

  it('decides true when git or the API fails', () => {
    const { error } = output();
    const git = history('README.md\0', '');
    expect(decide(['base', 'tested', 'head'], REPO, git, fake({}))).toBe(
      'true',
    );
    expect(decide(['base', 'tested', 'head'], REPO, fake({}), fake({}))).toBe(
      'true',
    );
    expect(error.mock.calls).toEqual([
      [
        `Mutation jobs run: cannot check the earlier result: unknown: ${runsCall('p1')}`,
      ],
      [
        'Mutation jobs run: cannot check the earlier result: unknown: rev-list --parents -n 1 head',
      ],
    ]);
  });

  it('needs the three commits', () => {
    for (const args of [
      ['', 'tested', 'head'],
      ['base', '', 'head'],
      ['base', 'tested', ''],
      ['base', 'tested'],
    ])
      expect(() => decide(args, REPO, fake({}), fake({}))).toThrow(
        'Usage: mutation-reuse.ts decide <base> <tested> <head>',
      );
  });

  const parentOf = (parents: { sha: string }[]) => ({
    [`api repos/${REPO}/git/commits/head`]: JSON.stringify({
      sha: 'head',
      parents,
    }),
  });

  it('verifies the green run of the first parent through the API', () => {
    const gh = fake({
      ...parentOf([{ sha: 'p1' }, { sha: 'base' }]),
      [runsCall('p1')]: runsAnswer(run()),
    });
    expect(verify('head', REPO, gh)).toEqual([]);
    const red = fake({
      ...parentOf([{ sha: 'p1' }, { sha: 'base' }]),
      [runsCall('p1')]: runsAnswer(),
    });
    expect(verify('head', REPO, red)).toEqual([
      `p1 has no check run "${CHECK}"`,
    ]);
    expect(verify('head', REPO, fake(parentOf([])))).toEqual([
      'head has no parent',
    ]);
    const bare = fake({
      [`api repos/${REPO}/git/commits/head`]: JSON.stringify({ sha: 'head' }),
    });
    expect(verify('head', REPO, bare)).toEqual(['head has no parent']);
  });

  it('prints the decision and answers the verification by its exit code', () => {
    const { log, error } = output();
    const git = history('README.md\0', '');
    const gh = fake({
      ...parentOf([{ sha: 'p1' }, { sha: 'base' }]),
      [runsCall('p1')]: runsAnswer(run()),
    });
    expect(main(['decide', 'base', 'tested', 'head'], REPO, git, gh)).toBe(0);
    expect(log.mock.calls).toEqual([['reuse']]);
    error.mockClear();
    expect(main(['verify', 'head'], REPO, git, gh)).toBe(0);
    expect(error.mock.calls).toEqual([
      [
        `The first parent of head has a green "${CHECK}": its result is taken over.`,
      ],
    ]);
    error.mockClear();
    const red = fake({
      ...parentOf([{ sha: 'p1' }]),
      [runsCall('p1')]: runsAnswer(run({ conclusion: 'failure' })),
    });
    expect(main(['verify', 'head'], REPO, git, red)).toBe(1);
    expect(error.mock.calls).toEqual([
      [
        `No mutation result to take over: the newest check run "${CHECK}" of p1 is failure`,
      ],
    ]);
  });

  it('needs a command and the repository', () => {
    const { error } = output();
    expect(main([], REPO, fake({}), fake({}))).toBe(1);
    expect(main(['verify'], REPO, fake({}), fake({}))).toBe(1);
    expect(main(['check', 'head'], REPO, fake({}), fake({}))).toBe(1);
    const usage =
      'Usage: mutation-reuse.ts decide <base> <tested> <head> | verify <head>';
    expect(error.mock.calls).toEqual([[usage], [usage], [usage]]);
    expect(() =>
      main(['verify', 'head'], undefined, fake({}), fake({})),
    ).toThrow('GITHUB_REPOSITORY names no repository.');
  });
});
