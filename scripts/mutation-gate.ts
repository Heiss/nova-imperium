// Per-file mutation standard (owner, 2026-11-11). Reads the Stryker JSON
// report and mutation-standard.json and fails when a file falls below its
// floor:
//   - a file with a recorded floor must not drop below it;
//   - a file without one must reach "newFile", a security file
//     "securityTarget".
// It also fails when the total score is below the break threshold of
// stryker.config.json: the shards of the CI run Stryker without it and
// check the merged report here (#131).
// Security files aim for "securityTarget"; their floor rises with each test.
// The floors are in mutation-floors.txt (one line per file), the rest of the
// standard in mutation-standard.json (#317 part 4). The floors are written
// from the merged report of a complete CI run only (#304, owner, 2026-11-19):
// scripts/mutation-floors.ts, not this script.
// Run after Stryker:
//   node scripts/mutation-gate.ts            check
//   node scripts/mutation-gate.ts --update   refused: a local report is no
//                                            source of floors (#304)
//   --report <path>                          another report than
//                                            reports/mutation/mutation.json
//                                            (the merged report of the shards)
//   --partial                                the report of a partial run of
//                                            the files in MUTATION_FILES (a
//                                            JSON list, #309): Stryker ran
//                                            exactly these files, and each
//                                            one is at or above its floor (a
//                                            file without one: "newFile"); no
//                                            total score, which says nothing
//                                            over a few files. Stryker leaves
//                                            a file without mutants out of
//                                            its report: a notice, no failure
import { readFileSync } from 'node:fs';
import { runCli } from './cli.ts';
import { FLOORS_FILE, parseFloors } from './mutation-floorfile.ts';
import { filesOf } from './mutation-partial.ts';

export interface Standard {
  securityTarget: number;
  newFile: number;
  security: string[];
  floors: Record<string, number>;
}

interface Mutant {
  status: string;
}

interface Report {
  files: Record<string, { mutants: Mutant[] }>;
  /** What Stryker ran with: its "mutate" list says which files (#309). */
  config?: { mutate?: unknown };
}

const REPORT = 'reports/mutation/mutation.json';
export const STANDARD = 'mutation-standard.json';
const CONFIG = 'stryker.config.json';
const KILLED = new Set(['Killed', 'Timeout']);
const COUNTED = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);

/** Score as Stryker counts it, in percent rounded down to two decimals. */
export function score(mutants: readonly Mutant[]): number | null {
  let killed = 0;
  let counted = 0;
  for (const m of mutants) {
    if (KILLED.has(m.status)) killed++;
    if (COUNTED.has(m.status)) counted++;
  }
  return counted ? Math.floor((killed / counted) * 10000) / 100 : null;
}

export function floorOf(
  file: string,
  standard: Standard,
): { min: number; why: string } {
  const recorded = standard.floors[file];
  if (recorded !== undefined) return { min: recorded, why: 'recorded floor' };
  return standard.security.includes(file)
    ? { min: standard.securityTarget, why: 'new security file' }
    : { min: standard.newFile, why: 'new file' };
}

/** One message per file below its floor. */
export function check(
  scores: Record<string, number>,
  standard: Standard,
): string[] {
  const failures: string[] = [];
  for (const [file, s] of Object.entries(scores)) {
    const { min, why } = floorOf(file, standard);
    if (s < min) failures.push(`${file}: ${s} % < ${min} % (${why})`);
  }
  return failures;
}

/**
 * The standard from the texts of mutation-standard.json (newFile, security,
 * securityTarget) and of the floors file. The floors have left the JSON file
 * (#317 part 4): a "floors" key there is refused, so a merge that brings it
 * back is not read as the floors.
 */
export function parseStandard(config: string, floors: string): Standard {
  const rest = JSON.parse(config) as Omit<Standard, 'floors'> & {
    floors?: unknown;
  };
  if (rest.floors !== undefined)
    throw new Error(
      `${STANDARD}: the floors are in ${FLOORS_FILE}, one line per file; remove "floors" here.`,
    );
  return { ...rest, floors: parseFloors(floors) };
}

/** What --update says: floors come from the merged report of the CI only. */
export const UPDATE_REFUSED =
  '--update is gone (#304): floors come only from the merged report of a complete CI run. Download it (gh run download <run-id> -n mutation-report) and run: node scripts/mutation-floors.ts <report.json>';

export function scoresOf(report: Report): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [file, f] of Object.entries(report.files)) {
    const s = score(f.mutants);
    if (s !== null) out[file] = s;
  }
  return out;
}

/** The total score of the report, as Stryker's "All files". */
export function totalOf(report: Report): number | null {
  return score(Object.values(report.files).flatMap((f) => f.mutants));
}

/** A message when the total is below the break threshold (null: none). */
export function checkTotal(
  total: number | null,
  breakAt: number | null,
): string[] {
  if (total === null || breakAt === null || total >= breakAt) return [];
  return [`${total} % < ${breakAt} % (break threshold of ${CONFIG})`];
}

/**
 * Why the report is not the one of the partial run of <files> (#309):
 * Stryker must have run with exactly these files (the "mutate" list in the
 * report, as the merge of the shards checks it), and the report holds no
 * other file. Stryker leaves a file without mutants (types.ts) out of its
 * report, so a file of the run that is not in it is no problem, see
 * withoutMutants.
 */
export function partialProblems(
  files: readonly string[],
  report: Report,
): string[] {
  const ran = report.config?.mutate;
  const same = (a: readonly string[], b: readonly string[]): boolean =>
    [...a].sort().join('\n') === [...b].sort().join('\n');
  const problems: string[] = [];
  if (!Array.isArray(ran) || !same(ran as string[], files))
    problems.push(
      `Stryker ran ${Array.isArray(ran) ? `[${ran.join(', ')}]` : 'an unknown list of files'}, not the files of the partial run`,
    );
  for (const file of Object.keys(report.files))
    if (!files.includes(file))
      problems.push(`${file}: in the report, not in the partial run`);
  return problems;
}

/** The files of a partial run that the report leaves out: they have no mutant. */
export function withoutMutants(
  files: readonly string[],
  report: Report,
): string[] {
  return files.filter((file) => !Object.hasOwn(report.files, file));
}

/**
 * Every failure of a report, as a workflow error line: a total below the
 * break threshold, a file below its floor. The report of a partial run
 * (#309, <partial> the files of the run) has no total score, which says
 * nothing over a few files, and must be the report of exactly these files.
 */
export function failures(
  report: Report,
  standard: Standard,
  breakAt: number | null,
  partial?: readonly string[],
): string[] {
  const below = check(scoresOf(report), standard).map(
    (f) => `::error::Mutation score below the floor: ${f}`,
  );
  if (partial)
    return [
      ...partialProblems(partial, report).map(
        (f) => `::error::Report of the partial run: ${f}`,
      ),
      ...below,
    ];
  return [
    ...checkTotal(totalOf(report), breakAt).map(
      (f) => `::error::Total mutation score below the break threshold: ${f}`,
    ),
    ...below,
  ];
}

/** The report to read: the path after --report, else Stryker's own. */
export function reportPath(args: readonly string[]): string {
  const at = args.indexOf('--report');
  if (at === -1) return REPORT;
  const path = args[at + 1];
  if (!path || path.startsWith('--'))
    throw new Error('--report needs the path of a report.');
  return path;
}

/** One line per file with its counts, to compare runs with each other. */
export function table(report: Report): string[] {
  return Object.keys(report.files)
    .sort()
    .map((file) => {
      const n: Record<string, number> = {};
      for (const m of report.files[file]!.mutants)
        n[m.status] = (n[m.status] ?? 0) + 1;
      const errors = (n.CompileError ?? 0) + (n.RuntimeError ?? 0);
      return `${file}: ${score(report.files[file]!.mutants) ?? '-'} % (killed ${n.Killed ?? 0}, timeout ${n.Timeout ?? 0}, survived ${n.Survived ?? 0}, no coverage ${n.NoCoverage ?? 0}, errors ${errors})`;
    });
}

function notices(scores: Record<string, number>, standard: Standard): void {
  for (const f of standard.security) {
    const s = scores[f];
    if (s !== undefined && s < standard.securityTarget)
      console.log(
        `::notice file=${f}::${f}: ${s} % of the ${standard.securityTarget} % target for security files`,
      );
  }
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--update')) throw new Error(UPDATE_REFUSED);
  const report = JSON.parse(readFileSync(reportPath(args), 'utf8')) as Report;
  const scores = scoresOf(report);
  const standard = parseStandard(
    readFileSync(STANDARD, 'utf8'),
    readFileSync(FLOORS_FILE, 'utf8'),
  );
  for (const line of table(report)) console.log(line);
  notices(scores, standard);
  const partial = args.includes('--partial')
    ? filesOf(process.env.MUTATION_FILES)
    : undefined;
  console.log(
    partial
      ? `Partial run of ${partial.length} files: no total score, every file against its floor.`
      : `Total mutation score: ${totalOf(report) ?? '-'} %`,
  );
  for (const file of partial ? withoutMutants(partial, report) : [])
    console.log(`::notice file=${file}::${file}: no mutants, nothing to check`);
  const { thresholds } = JSON.parse(readFileSync(CONFIG, 'utf8')) as {
    thresholds: { break: number | null };
  };
  const found = failures(report, standard, thresholds.break, partial);
  for (const f of found) console.log(f);
  if (found.length) return 1;
  console.log(
    `All ${Object.keys(scores).length} files at or above their floor.`,
  );
  return 0;
}

if (import.meta.main) runCli(main);
