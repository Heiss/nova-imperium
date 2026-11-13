// Whether a pull request takes over the mutation result of its previous head
// instead of mutating again (owner, 2026-11-13, #167). It does when its
// newest head commit only merged main:
//   - the head is a merge of two commits, the second one a commit of main
//     (an ancestor of the base) and the first one a commit of the pull
//     request (not an ancestor of the base);
//   - the commit the CI tests (refs/pull/N/merge) has the tree of the head,
//     so main did not move since the merge;
//   - the merge (first parent..head) changes no file of the mutation run
//     (a mutated file, a test file or the mutation configuration, as in
//     scripts/mutation-changes.ts, #146) that the pull request changes
//     against main too, and does not change the versions of the test tool
//     chain in the lockfile (revised by the owner, 2026-11-13); other files
//     from main (documentation, okf/, other tests, other code) do not
//     count, the push run of main and the nightly complete run test them;
//   - the newest check run "Mutation tests" of the first parent, read
//     through the API, is a success.
// Anything else, a failing git or API call included, runs the mutation jobs
// as before. A head that took over a result has a skipped "Mutation tests",
// so the next merge of main runs the jobs: reuse happens once in a row. The
// CI Gate checks the green run again before it accepts the skip.
//
//   node scripts/mutation-reuse.ts decide <base> <tested> <head>
//        prints "reuse" or "true", the reasons on stderr
//   node scripts/mutation-reuse.ts verify <head>
//        exits 0 when the first parent of <head> has a green "Mutation tests"
//
// The repository comes from GITHUB_REPOSITORY, the token for gh from GH_TOKEN
// (the job needs the permission "checks: read").
import { execFileSync } from 'node:child_process';
import { runCli } from './cli.ts';
import { lockfileReason, readMutate, reason } from './mutation-changes.ts';

/** The gate job of the mutation run in ci.yml, whose result is taken over. */
export const CHECK = 'Mutation tests';
/** The app of the check runs of GitHub Actions. */
export const ACTIONS = 'github-actions';

/** The fields of a check run of the REST API that the decision reads. */
export interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  app: { slug: string } | null;
}

/**
 * Why the check runs of a commit hold no green mutation result, or
 * undefined: the newest run of "Mutation tests" by GitHub Actions (the
 * highest id; a re-run gets a new one) must have completed with success. A
 * skipped, cancelled, failed or running one does not count.
 */
export function notGreen(
  sha: string,
  runs: readonly CheckRun[],
): string | undefined {
  const own = runs.filter((r) => r.name === CHECK && r.app?.slug === ACTIONS);
  if (!own.length) return `${sha} has no check run "${CHECK}"`;
  const newest = own.reduce((a, b) => (b.id > a.id ? b : a));
  if (newest.status === 'completed' && newest.conclusion === 'success')
    return undefined;
  return `the newest check run "${CHECK}" of ${sha} is ${newest.conclusion ?? newest.status}`;
}

/**
 * Why the files of the merge keep the earlier result from counting: a file of
 * the mutation run (mutated, a test or the mutation configuration, by the
 * "mutate" globs <mutate>) that the pull request changes too. Any other file
 * of the merge does not count.
 */
export function mergeReasons(
  merged: readonly string[],
  changed: readonly string[],
  mutate: readonly string[],
): string[] {
  const own = new Set(changed);
  return merged.flatMap((file) => {
    const why = own.has(file) ? reason(file, mutate) : undefined;
    return why
      ? [
          `the merge changes a file of the mutation run the pull request changes too: ${why}`,
        ]
      : [];
  });
}

type Run = (args: string[]) => string;

const names = (git: Run, from: string, to: string): string[] =>
  git(['diff', '--name-only', '-z', '--no-renames', from, to])
    .split('\0')
    .filter(Boolean);

const isAncestor = (git: Run, commit: string, of: string): boolean =>
  git(['merge-base', commit, of]).trim() === commit;

/**
 * The first parent of <head> whose result the pull request may take over,
 * and every reason against it from the history. <base> is the base commit,
 * <tested> the merge commit the CI tests, <mutate> the "mutate" globs of
 * stryker.config.json. git runs a git command and returns its output.
 */
export function mergeOfMain(
  base: string,
  tested: string,
  head: string,
  mutate: readonly string[],
  git: Run,
): { parent?: string; reasons: string[] } {
  const parents = git(['rev-list', '--parents', '-n', '1', head])
    .trim()
    .split(' ')
    .slice(1);
  if (parents.length !== 2)
    return { reasons: [`${head} is not a merge of two commits`] };
  const [parent, merged] = parents as [string, string];
  const reasons: string[] = [];
  if (!isAncestor(git, merged, base))
    reasons.push(`the second parent ${merged} is not a commit of main`);
  if (isAncestor(git, parent, base))
    reasons.push(
      `the first parent ${parent} is not a commit of the pull request`,
    );
  const tree = (rev: string): string => git(['rev-parse', `${rev}^{tree}`]);
  if (tree(tested) !== tree(head))
    reasons.push(
      `the tested commit ${tested} differs from the head ${head}: main moved after the merge`,
    );
  if (reasons.length) return { parent, reasons };
  const files = names(git, parent, head);
  const tools = lockfileReason(files, parent, head, git);
  return {
    parent,
    reasons: [
      ...mergeReasons(files, names(git, base, tested), mutate),
      ...(tools ? [`in the merge, ${tools}`] : []),
    ],
  };
}

/** The check runs of "Mutation tests" on a commit, through gh. */
export function checkRuns(sha: string, repo: string, gh: Run): CheckRun[] {
  const answer = JSON.parse(
    gh([
      'api',
      '--method',
      'GET',
      `repos/${repo}/commits/${sha}/check-runs`,
      '-f',
      `check_name=${CHECK}`,
      '-f',
      'filter=all',
      '-f',
      'per_page=100',
    ]),
  ) as { check_runs?: CheckRun[] };
  if (!Array.isArray(answer.check_runs))
    throw new Error(`no check runs in the answer for ${sha}`);
  return answer.check_runs;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * "reuse" when the pull request takes over the result of the first parent of
 * <head>, else "true"; the reasons on stderr.
 */
export function decide(
  [base, tested, head]: readonly string[],
  repo: string,
  mutate: readonly string[],
  git: Run,
  gh: Run,
): string {
  if (!base || !tested || !head)
    throw new Error('Usage: mutation-reuse.ts decide <base> <tested> <head>');
  let reasons: string[];
  try {
    const found = mergeOfMain(base, tested, head, mutate, git);
    reasons = found.reasons;
    if (!reasons.length) {
      const sha = found.parent!;
      const red = notGreen(sha, checkRuns(sha, repo, gh));
      if (red) reasons = [red];
    }
  } catch (error) {
    reasons = [`cannot check the earlier result: ${message(error)}`];
  }
  for (const r of reasons) console.error(`Mutation jobs run: ${r}`);
  if (reasons.length) return 'true';
  console.error(
    `The head only merged main: the mutation result of its first parent is taken over.`,
  );
  return 'reuse';
}

/** Whether the first parent of <head> has a green "Mutation tests" (API). */
export function verify(head: string, repo: string, gh: Run): string[] {
  const commit = JSON.parse(
    gh(['api', `repos/${repo}/git/commits/${head}`]),
  ) as { parents?: { sha: string }[] };
  const parent = commit.parents?.[0]?.sha;
  if (!parent) return [`${head} has no parent`];
  const red = notGreen(parent, checkRuns(parent, repo, gh));
  return red ? [red] : [];
}

/** Prints the verification of <head>; its exit code: 0 when green. */
function verified(head: string, repo: string, gh: Run): number {
  const reasons = verify(head, repo, gh);
  for (const r of reasons)
    console.error(`No mutation result to take over: ${r}`);
  if (reasons.length) return 1;
  console.error(
    `The first parent of ${head} has a green "${CHECK}": its result is taken over.`,
  );
  return 0;
}

const runner =
  (command: string): Run =>
  (args) =>
    execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    });

/**
 * Runs a command: decide prints its answer, verify answers by exit code.
 * decide reads the "mutate" globs of stryker.config.json in the working
 * directory unless <mutate> gives them.
 */
export function main(
  args: readonly string[] = process.argv.slice(2),
  repo: string | undefined = process.env.GITHUB_REPOSITORY,
  git: Run = runner('git'),
  gh: Run = runner('gh'),
  mutate?: readonly string[],
): number {
  const [command, ...rest] = args;
  if (!repo) throw new Error('GITHUB_REPOSITORY names no repository.');
  if (command === 'decide') {
    console.log(decide(rest, repo, mutate ?? readMutate(), git, gh));
    return 0;
  }
  if (command === 'verify' && rest[0]) return verified(rest[0], repo, gh);
  console.error(
    'Usage: mutation-reuse.ts decide <base> <tested> <head> | verify <head>',
  );
  return 1;
}

if (import.meta.main) runCli(() => main());
