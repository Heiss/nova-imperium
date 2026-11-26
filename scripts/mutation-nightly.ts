// Whether the last nightly complete mutation run on main is green (owner,
// 2026-11-26, #370, 194a via 197b). A pull request into main mutates only
// the files it changes while it is; when it is red or missing, the pull
// request runs the complete run, until a nightly run is green again.
// „The last nightly complete run“ is the newest completed run of
// .github/workflows/mutation.yml, event schedule, on main, of this
// repository; a cancelled run does not count, a run still going is not
// completed. Every error of the lookup counts as missing, so the rule fails
// towards the complete run.
//
//   node scripts/mutation-nightly.ts check
//        prints two lines: "green" or "red" (red stands for red and for
//        missing), then the line that names the run it looked at (also on
//        stderr)
//
// The repository comes from GITHUB_REPOSITORY, the token for gh from
// GH_TOKEN (the job needs "actions: read"). It reads the API only.
import { execFileSync } from 'node:child_process';
import { runCli } from './cli.ts';

/** The workflow of the nightly complete run. */
export const NIGHTLY = '.github/workflows/mutation.yml';

/** The fields of a workflow run the decision reads. */
export interface NightlyRun {
  id: number;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  html_url: string;
  repository: { full_name: string } | null;
}

/** Answers a GET of the REST API (a path below https://api.github.com/). */
export type Api = (path: string) => unknown;

/** The verdict on the last nightly run and the line that names it. */
export interface Verdict {
  green: boolean;
  line: string;
}

/**
 * The last nightly complete run of <repo> among <runs>: the newest (highest
 * id) completed run of the nightly workflow, event schedule, on main, that
 * was not cancelled. Undefined when there is none.
 */
export function lastNightly(
  repo: string,
  runs: readonly NightlyRun[],
): NightlyRun | undefined {
  return runs
    .filter(
      (r) =>
        r.path === NIGHTLY &&
        r.event === 'schedule' &&
        r.head_branch === 'main' &&
        r.repository?.full_name === repo &&
        r.status === 'completed' &&
        r.conclusion !== 'cancelled',
    )
    .sort((a, b) => b.id - a.id)[0];
}

/** The verdict on <run>: green only for a run that succeeded. */
export function verdictOf(run: NightlyRun | undefined): Verdict {
  if (!run)
    return {
      green: false,
      line: 'no completed nightly mutation run on main: the complete run',
    };
  const green = run.conclusion === 'success';
  return {
    green,
    line: `nightly mutation run ${run.id} on main: ${run.conclusion ?? 'no conclusion'} (${run.html_url})${green ? '' : ': the complete run'}`,
  };
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The verdict through the API; every error counts as a missing run. */
export function check(repo: string, api: Api): Verdict {
  try {
    const runs = (
      api(
        `repos/${repo}/actions/workflows/mutation.yml/runs?branch=main&event=schedule&status=completed&per_page=100`,
      ) as { workflow_runs?: unknown } | null
    )?.workflow_runs;
    if (!Array.isArray(runs))
      throw new Error('no list of workflow runs in the answer');
    return verdictOf(lastNightly(repo, runs as NightlyRun[]));
  } catch (error) {
    return {
      green: false,
      line: `cannot look up the nightly mutation run (${message(error)}): the complete run`,
    };
  }
}

/** The REST API through the command line tool gh, which reads GH_TOKEN. */
const gh: Api = (path) =>
  JSON.parse(
    execFileSync('gh', ['api', '--method', 'GET', path], {
      encoding: 'utf8',
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  ) as unknown;

/** check: prints green or red, then the line naming the run. */
export function main(
  api: Api,
  [command]: readonly string[],
  repo: string | undefined,
): number {
  if (command !== 'check') {
    console.error('Usage: mutation-nightly.ts check');
    return 1;
  }
  const verdict = repo
    ? check(repo, api)
    : {
        green: false,
        line: 'GITHUB_REPOSITORY names no repository: the complete run',
      };
  const line = verdict.line.replace(/[\r\n]/g, ' ');
  console.error(line);
  console.log(verdict.green ? 'green' : 'red');
  console.log(line);
  return 0;
}

if (import.meta.main)
  runCli(() => main(gh, process.argv.slice(2), process.env.GITHUB_REPOSITORY));
