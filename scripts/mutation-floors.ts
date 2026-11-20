// Writes the mutation floors (owner, 2026-11-19, #304 option 1): a floor in
// mutation-floors.txt comes from the merged report of a complete CI run, never
// from a local Stryker run, which the load of the machine can bend (timeouts
// count as killed). Local runs only find the surviving mutants.
//
//   node scripts/mutation-floors.ts <report.json> [--dry-run]
//        reads the merged report (artifact "mutation-report" of the run
//        "Mutation tests (nightly)" / mutation.yml, or of the complete run in
//        ci.yml) and
//          - adds the measured score of a file that has no floor,
//          - raises the floor of a file whose score is above it,
//          - drops the floor of a file that no longer exists.
//        A file below its floor (or, without one, below the minimum of a new
//        file or of a security file) stops everything: the message lists
//        these files and nothing is written; a floor never goes down. Scores
//        are the ones of scripts/mutation-gate.ts, rounded down to two
//        decimals. --dry-run prints the changes and writes nothing.
//   node scripts/mutation-floors.ts --format
//        writes mutation-floors.txt again in its form (sorted, one line per
//        file), e.g. after a merge by union; refuses a file with two lines
//
// Fetch the report of the newest complete run of a branch:
//   gh run list --workflow mutation.yml --branch <branch> --limit 5
//   gh run download <run-id> -n mutation-report -D reports/ci
//   node scripts/mutation-floors.ts reports/ci/mutation.json
// Check out the commit of that run first (gh run view <run-id> --json
// headSha), or later changes of tests can make the floors higher than the
// code has.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runCli } from './cli.ts';
import {
  FLOORS_FILE,
  formatFloors,
  parseFloors,
} from './mutation-floorfile.ts';
import {
  check,
  parseStandard,
  scoresOf,
  STANDARD,
  type Standard,
} from './mutation-gate.ts';
import { mutatedFiles } from './mutation-shards.ts';

export interface Change {
  file: string;
  from?: number;
  to: number;
}

export interface Raised {
  /** Every floor after the change; the old ones when something is below. */
  floors: Record<string, number>;
  added: Change[];
  raised: Change[];
  /** Floors of files that no longer exist. */
  removed: string[];
  /** One message per file below its floor: nothing may be written then. */
  below: string[];
}

/**
 * Why the report is not the merged report of a complete CI run, or undefined.
 * The merge (scripts/mutation-shards.ts) leaves out "config" and "testFiles";
 * a report of one Stryker run, local or the partial run of a pull request,
 * has them and covers only the files of its run.
 */
export function reportProblem(report: unknown): string | undefined {
  const r = report as {
    files?: unknown;
    config?: unknown;
    testFiles?: unknown;
  } | null;
  if (typeof r !== 'object' || r === null || typeof r.files !== 'object')
    return 'The file is no mutation report (no "files").';
  if (r.config !== undefined || r.testFiles !== undefined)
    return 'The report is the one of a single Stryker run (it has "config" or "testFiles"), not the merged report of a complete CI run. Floors come from the artifact "mutation-report" only (#304).';
  return undefined;
}

/**
 * The floors after the scores of a complete report. A file missing from the
 * report keeps its floor (Stryker leaves out a file without mutants), unless
 * the file is gone; a file of the report that is gone gets none.
 */
export function raise(
  scores: Readonly<Record<string, number>>,
  standard: Standard,
  exists: (file: string) => boolean,
): Raised {
  const below = check({ ...scores }, standard);
  const out: Raised = {
    floors: { ...standard.floors },
    added: [],
    raised: [],
    removed: [],
    below,
  };
  if (below.length) return out;
  const floors: Record<string, number> = {};
  const files = new Set([
    ...Object.keys(standard.floors),
    ...Object.keys(scores),
  ]);
  for (const file of [...files].sort()) {
    const was = standard.floors[file];
    const next = settle(was, scores[file], exists(file));
    if (next.floor !== undefined) floors[file] = next.floor;
    if (next.change === 'added') out.added.push({ file, to: next.floor });
    if (next.change === 'raised')
      out.raised.push({ file, from: was, to: next.floor });
    if (next.change === 'removed') out.removed.push(file);
  }
  out.floors = floors;
  return out;
}

type Settled =
  | { change?: undefined; floor?: number }
  | { change: 'added'; floor: number }
  | { change: 'raised'; floor: number }
  | { change: 'removed'; floor?: undefined };

/** The floor of one file after the report: was, the score now, the file here. */
function settle(
  was: number | undefined,
  now: number | undefined,
  here: boolean,
): Settled {
  if (!here) return was === undefined ? {} : { change: 'removed' };
  if (now === undefined) return was === undefined ? {} : { floor: was };
  if (was === undefined) return { change: 'added', floor: now };
  return now > was ? { change: 'raised', floor: now } : { floor: was };
}

/** The lines the command prints for a change. */
export function summary(r: Raised, dryRun: boolean): string[] {
  const lines = [
    ...r.added.map((c) => `added   ${c.file}: ${c.to} %`),
    ...r.raised.map((c) => `raised  ${c.file}: ${c.from} % -> ${c.to} %`),
    ...r.removed.map((f) => `removed ${f}: the file is gone`),
  ];
  lines.push(
    `Floors: ${r.added.length} added, ${r.raised.length} raised, ${r.removed.length} removed${dryRun ? ' (--dry-run: nothing written)' : ''}.`,
  );
  return lines;
}

/** What the command reads and writes; the defaults are the real ones. */
export interface Deps {
  read: (file: string) => string;
  write: (file: string, text: string) => void;
  exists: (file: string) => boolean;
  /** The files Stryker mutates in the checked-out tree. */
  mutated: () => string[];
  log: (line: string) => void;
}

const real: Deps = {
  read: (file) => readFileSync(file, 'utf8'),
  write: (file, text) => writeFileSync(file, text),
  exists: existsSync,
  mutated: () =>
    mutatedFiles(
      (
        JSON.parse(readFileSync('stryker.config.json', 'utf8')) as {
          mutate: string[];
        }
      ).mutate,
    ),
  log: (line) => console.log(line),
};

const USAGE = 'Usage: mutation-floors.ts <report.json> [--dry-run] | --format';

/** The floors of the report at <path> into the floors file. */
function fromReport(path: string, dryRun: boolean, d: Deps): number {
  const report: unknown = JSON.parse(d.read(path));
  const problem = reportProblem(report);
  if (problem) throw new Error(problem);
  const scores = scoresOf(report as Parameters<typeof scoresOf>[0]);
  const standard = parseStandard(d.read(STANDARD), d.read(FLOORS_FILE));
  const found = raise(scores, standard, d.exists);
  if (found.below.length) {
    for (const f of found.below) d.log(`below its floor: ${f}`);
    console.error(
      `${found.below.length} files are below their floor in the report. A floor never goes down: raise their tests, or remove the change that lowered them. Nothing was written.`,
    );
    return 1;
  }
  for (const line of summary(found, dryRun)) d.log(line);
  const unseen = d
    .mutated()
    .filter((f) => !Object.hasOwn(scores, f) && found.floors[f] === undefined);
  if (unseen.length)
    d.log(
      `Notice: ${unseen.length} mutated files of this tree are not in the report (no mutants, or newer than the run): ${unseen.join(', ')}`,
    );
  if (!dryRun) d.write(FLOORS_FILE, formatFloors(found.floors));
  return 0;
}

/** Runs the command; the exit code. See the head of the file. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  deps: Partial<Deps> = {},
): number {
  const d = { ...real, ...deps };
  if (args.includes('--format')) {
    d.write(FLOORS_FILE, formatFloors(parseFloors(d.read(FLOORS_FILE))));
    d.log(`${FLOORS_FILE} written in its form.`);
    return 0;
  }
  const paths = args.filter((a) => !a.startsWith('--'));
  const unknown = args.filter((a) => a.startsWith('--') && a !== '--dry-run');
  if (paths.length !== 1 || unknown.length) {
    console.error(USAGE);
    return 1;
  }
  return fromReport(paths[0]!, args.includes('--dry-run'), d);
}

if (import.meta.main) runCli(() => main());
