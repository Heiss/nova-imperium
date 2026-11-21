import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type Api,
  decide,
  greenRuns,
  type Job,
  JOBS,
  main,
  mergedPull,
  outputLines,
  type Pull,
  WORKFLOW,
  type WorkflowRun,
} from '../../scripts/already-tested.ts';

const REPO = 'owner/game';
const PUSHED = 'a1'; // the merge commit pushed to main
const HEAD = 'b2'; // the head commit the pull request was tested on
const TREE = 'tree-same';

/** A merged pull request as `GET /commits/{sha}/pulls` answers it. */
const pull = (fields: Partial<Pull> = {}): Pull => ({
  number: 7,
  merged_at: '2026-11-21T15:17:00Z',
  merge_commit_sha: PUSHED,
  base: { ref: 'main', repo: { full_name: REPO } },
  head: { sha: HEAD },
  ...fields,
});

/** A green CI run of the head, event pull_request, of the repository. */
const ciRun = (fields: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 100,
  path: WORKFLOW,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  head_sha: HEAD,
  repository: { full_name: REPO },
  head_repository: { full_name: REPO },
  ...fields,
});

const job = (name: string, conclusion: string | null = 'success'): Job => ({
  name,
  status: 'completed',
  conclusion,
  html_url: `https://github.com/${REPO}/actions/runs/100/job/${name.length}`,
});

/** Every job of a full run, green: the shards, the gate and the cheap ones too. */
const FULL: Job[] = [
  job('Detect changes'),
  job('Changelog fragments'),
  ...Object.values(JOBS).map((n) => job(n)),
  job('Mutation plan'),
  job('Mutation tests (shard 1 of 12)'),
  job('Mutation tests (changed files)', 'skipped'),
  job('CI Gate'),
];

/** A pull request whose run mutated its changed files only (#309). */
const PARTIAL: Job[] = FULL.map((j) =>
  j.name === 'Mutation tests' ||
  j.name === 'Mutation plan' ||
  j.name.startsWith('Mutation tests (shard')
    ? { ...j, conclusion: 'skipped' }
    : j.name === 'Mutation tests (changed files)'
      ? { ...j, conclusion: 'success' }
      : j,
);

interface World {
  pulls?: unknown;
  runs?: unknown;
  jobs?: Record<number, unknown>;
  trees?: Record<string, string>;
}

/** The recorded answers of the API; a path it does not know fails. */
const api =
  ({
    pulls = [pull()],
    runs = { workflow_runs: [ciRun()] },
    jobs = { 100: { jobs: FULL } },
    trees = { [PUSHED]: TREE, [HEAD]: TREE },
  }: World = {}): Api =>
  (path) => {
    if (path === `repos/${REPO}/commits/${PUSHED}/pulls?per_page=100`)
      return pulls;
    if (
      path ===
      `repos/${REPO}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${HEAD}&per_page=100`
    )
      return runs;
    const run =
      /^repos\/owner\/game\/actions\/runs\/(\d+)\/jobs\?filter=latest&per_page=100$/.exec(
        path,
      );
    if (run) {
      const answer = jobs[Number(run[1])];
      if (answer) return answer;
    }
    const commit = /^repos\/owner\/game\/git\/commits\/(\w+)$/.exec(path);
    if (commit && trees[commit[1]!])
      return { tree: { sha: trees[commit[1]!] } };
    throw new Error(`HTTP 404: ${path}`);
  };

const proven = (world?: World) =>
  Object.entries(decide(PUSHED, 'main', REPO, api(world)).proofs)
    .filter(([, proof]) => proof)
    .map(([key]) => key);

afterEach(() => vi.restoreAllMocks());

describe('a push that merged one pull request (#342)', () => {
  it('skips every expensive job that succeeded in the green run of the identical tree, and names it', () => {
    const { proofs, reasons } = decide(PUSHED, 'main', REPO, api());
    expect(Object.keys(proofs)).toEqual([
      'check',
      'e2e',
      'mutation',
      'compose',
      'site',
    ]);
    expect(proofs.e2e).toBe(
      `CI run 100, job "E2E tests (browser)" (https://github.com/${REPO}/actions/runs/100/job/19), head ${HEAD}, tree ${TREE}`,
    );
    expect(
      Object.values(proofs).every((p) => p.startsWith('CI run 100, job')),
    ).toBe(true);
    expect(reasons).toEqual([]);
  });

  it('takes the run of the changed files as the proof of the mutation jobs (owner, 2026-11-21)', () => {
    const { proofs } = decide(
      PUSHED,
      'main',
      REPO,
      api({ jobs: { 100: { jobs: PARTIAL } } }),
    );
    expect(proofs.mutation).toBe(
      `CI run 100, job "Mutation tests (changed files)" (https://github.com/${REPO}/actions/runs/100/job/30), head ${HEAD}, tree ${TREE}`,
    );
    expect(proven({ jobs: { 100: { jobs: PARTIAL } } })).toEqual([
      'check',
      'e2e',
      'mutation',
      'compose',
      'site',
    ]);
  });

  it('runs the mutation shards after a run with no mutation job, or one that took over the result of the head before', () => {
    // Nothing to mutate, or the result of the head before taken over
    // (#167): every mutation job of the run is skipped.
    const none = FULL.map((j) =>
      j.name.startsWith('Mutation') ? { ...j, conclusion: 'skipped' } : j,
    );
    expect(proven({ jobs: { 100: { jobs: none } } })).toEqual([
      'check',
      'e2e',
      'compose',
      'site',
    ]);
    // A failed run of the changed files is no proof either.
    const failed = PARTIAL.map((j) =>
      j.name === 'Mutation tests (changed files)'
        ? { ...j, conclusion: 'failure' }
        : j,
    );
    expect(proven({ jobs: { 100: { jobs: failed } } })).not.toContain(
      'mutation',
    );
  });

  it('runs a job that did not run in the pull request, or failed there in its latest attempt', () => {
    const jobs = FULL.filter((j) => j.name !== JOBS.site).map((j) =>
      j.name === JOBS.compose ? { ...j, conclusion: 'failure' } : j,
    );
    expect(proven({ jobs: { 100: { jobs } } })).toEqual([
      'check',
      'e2e',
      'mutation',
    ]);
    // A job still running is no proof either.
    const running = FULL.map((j) =>
      j.name === JOBS.check ? { ...j, status: 'in_progress' } : j,
    );
    expect(proven({ jobs: { 100: { jobs: running } } })).not.toContain('check');
  });

  it('takes each job from the newest green run that has it', () => {
    const older = FULL.filter((j) => j.name !== JOBS.mutation);
    const { proofs } = decide(
      PUSHED,
      'main',
      REPO,
      api({
        runs: { workflow_runs: [ciRun({ id: 90 }), ciRun({ id: 120 })] },
        jobs: { 90: { jobs: FULL }, 120: { jobs: older } },
      }),
    );
    expect(proofs.check).toMatch(/^CI run 120,/);
    expect(proofs.mutation).toMatch(/^CI run 90,/);
  });

  it('runs everything when the tree of the tested head differs from the pushed one', () => {
    const { proofs, reasons } = decide(
      PUSHED,
      'main',
      REPO,
      api({ trees: { [PUSHED]: TREE, [HEAD]: 'tree-other' } }),
    );
    expect(Object.values(proofs).every((p) => p === '')).toBe(true);
    expect(reasons[0]).toBe(
      `the head ${HEAD} of run 100 has the tree tree-other, the pushed commit the tree ${TREE}`,
    );
  });
});

describe('a push that proves nothing runs everything', () => {
  const nothing = (world: World): string[] =>
    decide(PUSHED, 'main', REPO, api(world)).reasons;

  it('without a pull request, a direct push', () => {
    expect(nothing({ pulls: [] })).toEqual([
      `${PUSHED} is the merge of no pull request into main`,
    ]);
    expect(proven({ pulls: [] })).toEqual([]);
  });

  it('with two pull requests for one commit', () => {
    expect(nothing({ pulls: [pull(), pull({ number: 8 })] })).toEqual([
      `${PUSHED} is the merge of 2 pull requests`,
    ]);
  });

  it('with a pull request that is not merged, merged another commit, went into another branch or another repository', () => {
    for (const other of [
      pull({ merged_at: null }),
      pull({ merge_commit_sha: 'c3' }),
      pull({ base: { ref: 'hotfix/26.11', repo: { full_name: REPO } } }),
      pull({ base: { ref: 'main', repo: { full_name: 'fork/game' } } }),
      pull({ base: { ref: 'main', repo: null } }),
    ])
      expect(proven({ pulls: [other] })).toEqual([]);
  });

  it('with a run of a fork, of another workflow, of another event or of another head', () => {
    for (const other of [
      ciRun({ head_repository: { full_name: 'fork/game' } }),
      ciRun({ head_repository: null }),
      ciRun({ repository: { full_name: 'fork/game' } }),
      ciRun({ repository: null }),
      ciRun({ path: '.github/workflows/mutation.yml' }),
      ciRun({ event: 'push' }),
      ciRun({ head_sha: 'c3' }),
    ]) {
      expect(proven({ runs: { workflow_runs: [other] } })).toEqual([]);
      expect(nothing({ runs: { workflow_runs: [other] } })).toEqual([
        `pull request #7: no green CI run of its head ${HEAD}`,
      ]);
    }
  });

  it('with a red, cancelled or running run', () => {
    for (const other of [
      ciRun({ conclusion: 'failure' }),
      ciRun({ conclusion: 'cancelled' }),
      ciRun({ status: 'in_progress', conclusion: null }),
    ])
      expect(proven({ runs: { workflow_runs: [other] } })).toEqual([]);
  });

  it('with the cheap run of the draft release pull request: its gate is red on purpose (#147)', () => {
    const cheap = FULL.map((j) =>
      Object.values(JOBS).includes(j.name as never) ||
      j.name.startsWith('Mutation')
        ? { ...j, conclusion: 'skipped' }
        : j.name === 'CI Gate'
          ? { ...j, conclusion: 'failure' }
          : j,
    );
    expect(
      proven({
        runs: { workflow_runs: [ciRun({ conclusion: 'failure' })] },
        jobs: { 100: { jobs: cheap } },
      }),
    ).toEqual([]);
  });

  it('with an error of the API at any step', () => {
    const failing: Api = () => {
      throw new Error('HTTP 502');
    };
    expect(decide(PUSHED, 'main', REPO, failing)).toEqual({
      proofs: { check: '', e2e: '', mutation: '', compose: '', site: '' },
      reasons: ['cannot look up an earlier run: HTTP 502'],
    });
    expect(nothing({ jobs: {} })).toEqual([
      `cannot look up an earlier run: HTTP 404: repos/${REPO}/actions/runs/100/jobs?filter=latest&per_page=100`,
    ]);
    expect(nothing({ trees: { [HEAD]: TREE } })).toEqual([
      `cannot look up an earlier run: HTTP 404: repos/${REPO}/git/commits/${PUSHED}`,
    ]);
    expect(
      nothing({ trees: {}, pulls: [pull()], jobs: { 100: { jobs: FULL } } }),
    ).toEqual([
      `cannot look up an earlier run: HTTP 404: repos/${REPO}/git/commits/${PUSHED}`,
    ]);
  });

  it('with an answer of an unexpected shape', () => {
    expect(nothing({ pulls: { message: 'Not Found' } })).toEqual([
      'cannot look up an earlier run: no list of pull requests in the answer',
    ]);
    expect(nothing({ runs: {} })).toEqual([
      'cannot look up an earlier run: no list of workflow runs in the answer',
    ]);
    expect(nothing({ jobs: { 100: { total_count: 0 } } })).toEqual([
      'cannot look up an earlier run: no list of jobs in the answer',
    ]);
    const noTree: Api = (path) =>
      path.includes('/git/commits/') ? { tree: {} } : api()(path);
    expect(decide(PUSHED, 'main', REPO, noTree).reasons).toEqual([
      `cannot look up an earlier run: no tree for ${PUSHED}`,
    ]);
    const stringError: Api = () => {
      throw 'gh failed';
    };
    expect(decide(PUSHED, 'main', REPO, stringError).reasons).toEqual([
      'cannot look up an earlier run: gh failed',
    ]);
  });
});

describe('the parts', () => {
  it('finds the one merged pull request of the branch', () => {
    expect(mergedPull(PUSHED, 'main', REPO, [pull()])).toEqual(pull());
    expect(
      mergedPull(PUSHED, 'hotfix/26.11', REPO, [
        pull(),
        pull({
          number: 9,
          base: { ref: 'hotfix/26.11', repo: { full_name: REPO } },
        }),
      ]),
    ).toMatchObject({ number: 9 });
  });

  it('orders the green runs newest first', () => {
    expect(
      greenRuns(HEAD, REPO, [
        ciRun({ id: 2 }),
        ciRun({ id: 5 }),
        ciRun({ id: 3 }),
      ]).map((r) => r.id),
    ).toEqual([5, 3, 2]);
  });

  it('writes one output line per job, on one line each', () => {
    expect(
      outputLines({
        check: 'a\nb',
        e2e: '',
        mutation: 'c\r\nd',
        compose: '',
        site: 'e',
      }),
    ).toEqual([
      'proof-check=a b',
      'proof-e2e=',
      'proof-mutation=c  d',
      'proof-compose=',
      'proof-site=e',
    ]);
  });
});

describe('the command', () => {
  it('prints the output lines and says on stderr what is proven and what runs', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const jobs = {
      100: {
        jobs: FULL.map((j) =>
          j.name.startsWith('Mutation') ? { ...j, conclusion: 'skipped' } : j,
        ),
      },
    };
    expect(main(['decide', PUSHED, 'main'], REPO, api({ jobs }))).toBe(0);
    const lines = out.mock.calls.map((c) => String(c[0]));
    expect(lines.map((l) => l.split('=')[0])).toEqual([
      'proof-check',
      'proof-e2e',
      'proof-mutation',
      'proof-compose',
      'proof-site',
    ]);
    expect(lines[2]).toBe('proof-mutation=');
    expect(lines[0]).toMatch(/^proof-check=CI run 100, job "Lint/);
    const said = err.mock.calls.map((c) => String(c[0]));
    expect(said).toContain(
      'Runs on this push: "Mutation tests" or "Mutation tests (changed files)" succeeded in no green run of the identical tree',
    );
    expect(said.filter((s) => s.startsWith('Proven, skipped: '))).toHaveLength(
      4,
    );
    expect(said).toContain(
      `Proven, skipped: E2E tests (browser): CI run 100, job "E2E tests (browser)" (https://github.com/${REPO}/actions/runs/100/job/19), head ${HEAD}, tree ${TREE}`,
    );
  });

  it('refuses a wrong call and needs the repository', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(main(['decide', PUSHED], REPO, api())).toBe(1);
    expect(main(['verify', PUSHED, 'main'], REPO, api())).toBe(1);
    expect(main([], REPO, api())).toBe(1);
    expect(err).toHaveBeenCalledWith(
      'Usage: already-tested.ts decide <sha> <branch>',
    );
    expect(() => main(['decide', PUSHED, 'main'], undefined, api())).toThrow(
      'GITHUB_REPOSITORY names no repository.',
    );
  });
});
