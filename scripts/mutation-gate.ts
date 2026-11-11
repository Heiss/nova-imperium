// Per-file mutation standard (owner, 2026-11-11). Reads the Stryker JSON
// report and mutation-standard.json and fails when a file falls below its
// floor:
//   - a file with a recorded floor must not drop below it;
//   - a file without one must reach "newFile", a security file
//     "securityTarget".
// Security files aim for "securityTarget"; their floor rises with each test.
// Run after Stryker:
//   node scripts/mutation-gate.ts            check
//   node scripts/mutation-gate.ts --update   raise the floors to the current
//                                            scores (never lowers one)
import { readFileSync, writeFileSync } from 'node:fs';

export interface Standard {
  securityTarget: number;
  newFile: number;
  security: string[];
  floors: Record<string, number>;
}

interface Mutant {
  status: string;
}

const REPORT = 'reports/mutation/mutation.json';
const STANDARD = 'mutation-standard.json';
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

/** Raises every floor to the current score; files that are gone lose theirs. */
export function update(
  scores: Record<string, number>,
  standard: Standard,
): Standard {
  const floors: Record<string, number> = {};
  for (const file of Object.keys(scores).sort())
    floors[file] = Math.max(standard.floors[file] ?? 0, scores[file]!);
  return { ...standard, floors };
}

export function scoresOf(report: {
  files: Record<string, { mutants: Mutant[] }>;
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [file, f] of Object.entries(report.files)) {
    const s = score(f.mutants);
    if (s !== null) out[file] = s;
  }
  return out;
}

function main(): void {
  const scores = scoresOf(JSON.parse(readFileSync(REPORT, 'utf8')));
  const standard = JSON.parse(readFileSync(STANDARD, 'utf8')) as Standard;
  if (process.argv.includes('--update')) {
    const next = update(scores, standard);
    writeFileSync(STANDARD, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Floors of ${Object.keys(scores).length} files written.`);
    return;
  }
  for (const f of standard.security) {
    const s = scores[f];
    if (s !== undefined && s < standard.securityTarget)
      console.log(
        `::notice file=${f}::${f}: ${s} % of the ${standard.securityTarget} % target for security files`,
      );
  }
  const failures = check(scores, standard);
  for (const f of failures)
    console.log(`::error::Mutation score below the floor: ${f}`);
  if (failures.length) process.exit(1);
  console.log(
    `All ${Object.keys(scores).length} files at or above their floor.`,
  );
}

if (import.meta.main) main();
