// Whether a push run of main or a hotfix branch may skip an expensive job
// because the same job already succeeded on the identical content (owner,
// 2026-11-21, #342). It may when:
//   - the pushed commit is the merge of exactly one merged pull request of
//     this repository into the pushed branch (its merge commit);
//   - a run of the workflow "CI" (.github/workflows/ci.yml) of that pull
//     request's head commit, event pull_request, of this repository and not
//     of a fork, completed with success, so its CI Gate was green;
//   - the head commit that run names (its head_sha) has the Git tree of the
//     pushed commit: trees are compared, never commit ids;
//   - the job of that run (its latest attempt) succeeded.
// Each job is proven on its own: a job that did not run there runs on the
// push as before. The mutation jobs of the push are proven by the complete
// run or by the run of the changed files (#309) of the pull request (owner,
// 2026-11-21), and by a run whose „Detect changes“ found nothing to mutate
// (its note „Mutation jobs“ says false; coordinator, 2026-11-21): the
// complete shards run in the release pull request, the nightly run and a
// push whose tree is not proven. A pull request that took over the result of
// its head before (#167, note „reuse“) proves none: that was another tree. Any other case, an error of
// the API included, proves nothing, and the push runs everything: the rule
// fails closed.
// A push that differs from its parent only in the metadata files VERSION,
// CHANGELOG.md and changes/ (the merge of a release pull request, which runs
// no expensive job, #387) takes over every job the green push run of its
// parent on the same branch succeeded in or skipped with its own proof
// (owner, 2026-11-24, 77a): those files change no test result but the ones
// that read them (src/test/release-metadata.test.ts names every reader).
//
//   node scripts/already-tested.ts decide <sha> <branch>
//        prints "proof-<job>=<proof>" for each job, empty without a proof
//        (the lines go to $GITHUB_OUTPUT), the reasons on stderr
//
// The repository comes from GITHUB_REPOSITORY, the token for gh from GH_TOKEN
// (the job needs "actions: read", "pull-requests: read", "contents: read").
// It reads the API only; nothing of a pull request is checked out or run.
import { execFileSync } from 'node:child_process';
import { runCli } from './cli.ts';

/** The workflow whose runs count. */
export const WORKFLOW = '.github/workflows/ci.yml';

/** The expensive jobs of ci.yml a push may skip, by the key of their output. */
export const JOBS = {
  check: 'Lint, types, unit tests with coverage, build',
  e2e: 'E2E tests (browser)',
  mutation: 'Mutation tests',
  compose: 'Docker image and Compose stack',
  site: 'Documentation website',
} as const;

export type JobKey = keyof typeof JOBS;

/**
 * The jobs of the pull request's run that prove each job of the push. The
 * mutation jobs of the push are proven by the complete run of the pull
 * request or by its run of the changed files (#309): the release pull
 * request and the nightly run run the complete shards (owner, 2026-11-21,
 * #342).
 */
export const PROVEN_BY: Readonly<Record<JobKey, readonly string[]>> = {
  check: [JOBS.check],
  e2e: [JOBS.e2e],
  mutation: [JOBS.mutation, 'Mutation tests (changed files)'],
  compose: [JOBS.compose],
  site: [JOBS.site],
};

/** The fields of a pull request of `GET /commits/{sha}/pulls` the decision reads. */
export interface Pull {
  number: number;
  merged_at: string | null;
  merge_commit_sha: string | null;
  base: { ref: string; repo: { full_name: string } | null };
  head: { sha: string };
}

/** The fields of a workflow run the decision reads. */
export interface WorkflowRun {
  id: number;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  head_branch?: string | null;
  repository: { full_name: string } | null;
  head_repository: { full_name: string } | null;
}

/** The fields of a job of a workflow run the decision reads. */
export interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

/** The fields of an annotation of a check run (a job) the decision reads. */
export interface Annotation {
  title: string | null;
  message: string;
}

/**
 * The metadata files of a release (#387): a release pull request changes
 * nothing else, and a push that differs from its parent only in them takes
 * over the proofs of the parent.
 */
export const METADATA = ['VERSION', 'CHANGELOG.md', 'changes/'] as const;

/** Whether a changed file is one of the metadata files. */
export const isMetadata = (file: string): boolean =>
  METADATA.some((m) => (m.endsWith('/') ? file.startsWith(m) : file === m));

/** The job that decides which checks a run needs, and its note of the mutation jobs. */
export const DETECT = 'Detect changes';
export const MUTATION_NOTE = 'Mutation jobs';

/** Answers a GET of the REST API (a path below https://api.github.com/). */
export type Api = (path: string) => unknown;

/** The proof of each job, empty for a job that runs, and why the others run. */
export interface Decision {
  proofs: Record<JobKey, string>;
  reasons: string[];
}

const KEYS = Object.keys(JOBS) as JobKey[];

const none = (): Record<JobKey, string> =>
  Object.fromEntries(KEYS.map((k) => [k, ''])) as Record<JobKey, string>;

/**
 * The one merged pull request of <repo> whose merge commit is <sha> on the
 * branch <branch>, or why there is none.
 */
export function mergedPull(
  sha: string,
  branch: string,
  repo: string,
  pulls: readonly Pull[],
): Pull | string {
  const merged = pulls.filter(
    (p) =>
      p.merged_at !== null &&
      p.merge_commit_sha === sha &&
      p.base.ref === branch &&
      p.base.repo?.full_name === repo,
  );
  if (merged.length === 1) return merged[0]!;
  return merged.length
    ? `${sha} is the merge of ${merged.length} pull requests`
    : `${sha} is the merge of no pull request into ${branch}`;
}

/**
 * The runs of <head> that may prove a job, newest first: the workflow "CI",
 * event pull_request, of <repo> itself and not of a fork, completed with
 * success.
 */
export function greenRuns(
  head: string,
  repo: string,
  runs: readonly WorkflowRun[],
): WorkflowRun[] {
  return runs
    .filter(
      (r) =>
        r.head_sha === head &&
        r.path === WORKFLOW &&
        r.event === 'pull_request' &&
        r.repository?.full_name === repo &&
        r.head_repository?.full_name === repo &&
        r.status === 'completed' &&
        r.conclusion === 'success',
    )
    .sort((a, b) => b.id - a.id);
}

/** The first job of <jobs> named in <names> that completed with success. */
const succeeded = (
  jobs: readonly Job[],
  names: readonly string[],
): Job | undefined =>
  jobs.find(
    (j) =>
      names.includes(j.name) &&
      j.status === 'completed' &&
      j.conclusion === 'success',
  );

/**
 * The job „Detect changes“ of a run that found nothing to mutate: its note
 * „Mutation jobs“ says false (no mutated file, test, mutation configuration
 * or test tool chain changed). A taken-over result (#167) says reuse and
 * proves nothing: it was tested on another tree.
 */
function nothingToMutate(
  jobs: readonly Job[],
  notesOf: (job: number) => readonly Annotation[],
): Job | undefined {
  const detect = succeeded(jobs, [DETECT]);
  if (!detect) return undefined;
  return notesOf(detect.id).some(
    (a) => a.title === MUTATION_NOTE && a.message === 'false',
  )
    ? detect
    : undefined;
}

/** The proof of one job in one run of the identical tree, or undefined. */
function proofIn(
  key: JobKey,
  r: WorkflowRun,
  tree: string,
  jobs: readonly Job[],
  notesOf: (job: number) => readonly Annotation[],
): string | undefined {
  const at = `head ${r.head_sha}, tree ${tree}`;
  const job = succeeded(jobs, PROVEN_BY[key]);
  if (job) return `CI run ${r.id}, job "${job.name}" (${job.html_url}), ${at}`;
  if (key !== 'mutation') return undefined;
  const detect = nothingToMutate(jobs, notesOf);
  return detect
    ? `CI run ${r.id}, job "${detect.name}" (${detect.html_url}) found nothing to mutate, ${at}`
    : undefined;
}

/**
 * The proof of each job from the green runs: the newest run whose job
 * succeeded, on a head with the tree <tree> of the pushed commit.
 */
export function proofsOf(
  tree: string,
  runs: readonly WorkflowRun[],
  treeOf: (sha: string) => string,
  jobsOf: (run: number) => readonly Job[],
  notesOf: (job: number) => readonly Annotation[],
): Decision {
  const proofs = none();
  const reasons: string[] = [];
  const same = runs.filter((r) => {
    const own = treeOf(r.head_sha);
    if (own === tree) return true;
    reasons.push(
      `the head ${r.head_sha} of run ${r.id} has the tree ${own}, the pushed commit the tree ${tree}`,
    );
    return false;
  });
  for (const key of KEYS) {
    for (const r of same) {
      const proof = proofIn(key, r, tree, jobsOf(r.id), notesOf);
      if (!proof) continue;
      proofs[key] = proof;
      break;
    }
    if (!proofs[key])
      reasons.push(
        `${PROVEN_BY[key].map((n) => `"${n}"`).join(' or ')} succeeded in no green run of the identical tree`,
      );
  }
  return { proofs, reasons };
}

/**
 * The green push runs of the commit <parent> on <branch>, newest first:
 * the workflow "CI", event push, of <repo> and of the pushed branch (a run
 * of the same commit on another branch proves nothing here; CodeRabbit on
 * #395), completed with success.
 */
export function greenPushRuns(
  parent: string,
  branch: string,
  repo: string,
  runs: readonly WorkflowRun[],
): WorkflowRun[] {
  return runs
    .filter(
      (r) =>
        r.head_sha === parent &&
        r.head_branch === branch &&
        r.path === WORKFLOW &&
        r.event === 'push' &&
        r.repository?.full_name === repo &&
        r.status === 'completed' &&
        r.conclusion === 'success',
    )
    .sort((a, b) => b.id - a.id);
}

/**
 * The proofs a push that changed only the metadata files takes over from
 * the green push run <run> of its parent: a job that succeeded there, or
 * that run skipped with its own proof (a green push run skips a job only
 * with one, #342), for every job <missing> still lacks.
 */
export function parentProofs(
  run: WorkflowRun,
  jobs: readonly Job[],
  missing: readonly JobKey[],
): Partial<Record<JobKey, string>> {
  const proofs: Partial<Record<JobKey, string>> = {};
  for (const key of missing) {
    const job = jobs.find(
      (j) =>
        j.name === JOBS[key] &&
        j.status === 'completed' &&
        (j.conclusion === 'success' || j.conclusion === 'skipped'),
    );
    if (job)
      proofs[key] =
        `CI run ${run.id} of the parent ${run.head_sha}, job "${job.name}" ${job.conclusion === 'success' ? 'succeeded' : 'was proven there'} (${job.html_url}); the push changes only ${METADATA.join(', ')}`;
  }
  return proofs;
}

/** The most files the compare API lists; a longer change proves nothing. */
const COMPARE_LIMIT = 300;

/** The first parent of <sha>, through the API. */
function parentOf(sha: string, repo: string, api: Api): string | undefined {
  return listOf<{ sha: string }>(
    api(`repos/${repo}/commits/${sha}`),
    'parents',
    'parents',
  )[0]?.sha;
}

/** Whether <sha> changes only the metadata files against <parent>. */
function onlyMetadata(
  parent: string,
  sha: string,
  repo: string,
  api: Api,
): boolean {
  // A moved file counts with its old and its new name: a file moved out of
  // the code into changes/ is no metadata (CodeRabbit on #395).
  const files = listOf<{ filename: string; previous_filename?: string }>(
    api(`repos/${repo}/compare/${parent}...${sha}`),
    'files',
    'changed files',
  ).flatMap((f) =>
    f.previous_filename ? [f.filename, f.previous_filename] : [f.filename],
  );
  return (
    files.length > 0 &&
    files.length < COMPARE_LIMIT &&
    files.every((f) => isMetadata(f))
  );
}

/** The newest green push run of <parent>, through the API. */
const parentRun = (
  parent: string,
  branch: string,
  repo: string,
  api: Api,
): WorkflowRun | undefined =>
  greenPushRuns(
    parent,
    branch,
    repo,
    listOf<WorkflowRun>(
      api(
        `repos/${repo}/actions/workflows/ci.yml/runs?event=push&head_sha=${parent}&per_page=100`,
      ),
      'workflow_runs',
      'workflow runs',
    ),
  )[0];

/**
 * The proofs of the parent for the jobs of <decision> without one, when the
 * push <sha> changes only the metadata files against its first parent.
 */
function fromParent(
  decision: Decision,
  sha: string,
  branch: string,
  repo: string,
  api: Api,
): Decision {
  const missing = KEYS.filter((k) => !decision.proofs[k]);
  if (!missing.length) return decision;
  const why = (reason: string): Decision => ({
    ...decision,
    reasons: [...decision.reasons, reason],
  });
  const parent = parentOf(sha, repo, api);
  if (!parent) return why(`${sha} has no parent`);
  if (!onlyMetadata(parent, sha, repo, api))
    return why(
      `the push changes more than ${METADATA.join(', ')} against its parent ${parent}`,
    );
  const run = parentRun(parent, branch, repo, api);
  if (!run) return why(`no green push run of the parent ${parent}`);
  const taken = parentProofs(run, jobsThrough(api, repo)(run.id), missing);
  return {
    proofs: { ...decision.proofs, ...taken },
    reasons: [
      ...decision.reasons,
      ...missing
        .filter((k) => !taken[k])
        .map(
          (k) =>
            `"${JOBS[k]}" did not succeed in the push run ${run.id} of the parent`,
        ),
    ],
  };
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The tree of a commit, through the API. */
const treeThrough =
  (api: Api, repo: string) =>
  (sha: string): string => {
    const tree = (
      api(`repos/${repo}/git/commits/${sha}`) as {
        tree?: { sha?: unknown };
      }
    ).tree?.sha;
    if (typeof tree !== 'string') throw new Error(`no tree for ${sha}`);
    return tree;
  };

/** A list field of an answer, or an error when the answer has none. */
function listOf<T>(answer: unknown, field: string | null, what: string): T[] {
  const list = field
    ? (answer as Record<string, unknown> | null)?.[field]
    : answer;
  if (!Array.isArray(list)) throw new Error(`no list of ${what} in the answer`);
  return list as T[];
}

/** The green CI runs of the head commit <head> of a pull request. */
const runsOfHead = (api: Api, repo: string, head: string): WorkflowRun[] =>
  greenRuns(
    head,
    repo,
    listOf<WorkflowRun>(
      api(
        `repos/${repo}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${head}&per_page=100`,
      ),
      'workflow_runs',
      'workflow runs',
    ),
  );

/** The jobs of a run, latest attempt, through the API. */
const jobsThrough =
  (api: Api, repo: string) =>
  (id: number): Job[] =>
    listOf<Job>(
      api(`repos/${repo}/actions/runs/${id}/jobs?filter=latest&per_page=100`),
      'jobs',
      'jobs',
    );

/** The proofs for the push of <sha> to <branch>; an error of the API throws. */
function lookUp(sha: string, branch: string, repo: string, api: Api): Decision {
  const pull = mergedPull(
    sha,
    branch,
    repo,
    listOf<Pull>(
      api(`repos/${repo}/commits/${sha}/pulls?per_page=100`),
      null,
      'pull requests',
    ),
  );
  if (typeof pull === 'string') return { proofs: none(), reasons: [pull] };
  const head = pull.head.sha;
  const runs = runsOfHead(api, repo, head);
  if (!runs.length)
    return {
      proofs: none(),
      reasons: [
        `pull request #${pull.number}: no green CI run of its head ${head}`,
      ],
    };
  const treeOf = treeThrough(api, repo);
  return proofsOf(treeOf(sha), runs, treeOf, jobsThrough(api, repo), (id) =>
    listOf<Annotation>(
      api(`repos/${repo}/check-runs/${id}/annotations?per_page=100`),
      null,
      'annotations',
    ),
  );
}

/**
 * The proofs for the push of <sha> to <branch> of <repo>; every error of the
 * API proves nothing (the push runs everything).
 */
export function decide(
  sha: string,
  branch: string,
  repo: string,
  api: Api,
): Decision {
  try {
    const decision = lookUp(sha, branch, repo, api);
    try {
      return fromParent(decision, sha, branch, repo, api);
    } catch (error) {
      // The parent proves nothing on an error; the proofs found stay.
      return {
        ...decision,
        reasons: [
          ...decision.reasons,
          `cannot look up the parent: ${message(error)}`,
        ],
      };
    }
  } catch (error) {
    return {
      proofs: none(),
      reasons: [`cannot look up an earlier run: ${message(error)}`],
    };
  }
}

/** The lines for $GITHUB_OUTPUT: one "proof-<job>=" per job. */
export const outputLines = (proofs: Record<JobKey, string>): string[] =>
  KEYS.map((k) => `proof-${k}=${proofs[k].replace(/[\r\n]/g, ' ')}`);

/** The REST API through the command line tool gh, which reads GH_TOKEN. */
const gh: Api = (path) =>
  JSON.parse(
    execFileSync('gh', ['api', '--method', 'GET', path], {
      encoding: 'utf8',
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  ) as unknown;

/** Says on stderr why each job runs or which proof skips it. */
function report({ proofs, reasons }: Decision): void {
  for (const r of reasons) console.error(`Runs on this push: ${r}`);
  for (const k of KEYS)
    if (proofs[k]) console.error(`Proven, skipped: ${JOBS[k]}: ${proofs[k]}`);
}

/** decide: prints the output lines, the proofs and the reasons on stderr. */
export function main(
  api: Api,
  [command, sha, branch]: readonly string[],
  repo: string | undefined,
): number {
  if (command !== 'decide' || !sha || !branch) {
    console.error('Usage: already-tested.ts decide <sha> <branch>');
    return 1;
  }
  if (!repo) throw new Error('GITHUB_REPOSITORY names no repository.');
  const decision = decide(sha, branch, repo, api);
  report(decision);
  for (const line of outputLines(decision.proofs)) console.log(line);
  return 0;
}

if (import.meta.main)
  runCli(() => main(gh, process.argv.slice(2), process.env.GITHUB_REPOSITORY));
