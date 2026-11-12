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
// Run after Stryker:
//   node scripts/mutation-gate.ts            check
//   node scripts/mutation-gate.ts --update   raise the floors to the current
//                                            scores (never lowers one)
//   --report <path>                          another report than
//                                            reports/mutation/mutation.json
//                                            (the merged report of the shards)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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
}

const REPORT = 'reports/mutation/mutation.json';
const STANDARD = 'mutation-standard.json';
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
 * Raises every floor to the current score. A file missing from the report
 * keeps its floor (a run of some files only must not erase the others);
 * a file that no longer exists loses it.
 */
export function update(
  scores: Record<string, number>,
  standard: Standard,
  exists: (file: string) => boolean = existsSync,
): Standard {
  const floors: Record<string, number> = {};
  const files = new Set([
    ...Object.keys(standard.floors),
    ...Object.keys(scores),
  ]);
  for (const file of [...files].sort()) {
    const was = standard.floors[file];
    const now = scores[file];
    if (now !== undefined) floors[file] = Math.max(was ?? 0, now);
    else if (was !== undefined && exists(file)) floors[file] = was;
  }
  return { ...standard, floors };
}

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

function main(): void {
  const args = process.argv.slice(2);
  const report = JSON.parse(readFileSync(reportPath(args), 'utf8')) as Report;
  const scores = scoresOf(report);
  const standard = JSON.parse(readFileSync(STANDARD, 'utf8')) as Standard;
  if (args.includes('--update')) {
    const next = update(scores, standard);
    writeFileSync(STANDARD, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Floors of ${Object.keys(scores).length} files written.`);
    return;
  }
  for (const line of table(report)) console.log(line);
  const total = totalOf(report);
  console.log(`Total mutation score: ${total ?? '-'} %`);
  notices(scores, standard);
  const { thresholds } = JSON.parse(readFileSync(CONFIG, 'utf8')) as {
    thresholds: { break: number | null };
  };
  const failures = [
    ...checkTotal(total, thresholds.break).map(
      (f) => `::error::Total mutation score below the break threshold: ${f}`,
    ),
    ...check(scores, standard).map(
      (f) => `::error::Mutation score below the floor: ${f}`,
    ),
  ];
  for (const f of failures) console.log(f);
  if (failures.length) process.exit(1);
  console.log(
    `All ${Object.keys(scores).length} files at or above their floor.`,
  );
}

if (import.meta.main) main();
