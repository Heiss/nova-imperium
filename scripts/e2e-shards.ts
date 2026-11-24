// The parts of the E2E suite in CI (#372; owner, 2026-11-23, #387: a pull
// request into main runs the complete E2E suite, split over several jobs).
// Each job starts its own servers with their own data (playwright.config.ts)
// and runs the spec files of its part; together the parts are the suite.
//
//   node scripts/e2e-shards.ts files <part>
//        prints the spec files of part <part> (1 to PARTS), one per line
//   node scripts/e2e-shards.ts plan <report.json>
//        writes e2e/shards.json from a JSON report of Playwright (the time
//        of every spec file), so the parts take about the same time
//
// A spec file the plan does not know yet goes to the part its name hashes
// to, so a new spec runs in exactly one job without a change of the
// workflow; the next plan places it by its time.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from './cli.ts';

/** How many E2E jobs run in CI; the matrix of ci.yml lists 1 to PARTS. */
export const PARTS = 4;

/** The plan: the part of every spec file it knows, from 1 to PARTS. */
export const PLAN_FILE = 'e2e/shards.json';

export interface Plan {
  parts: number;
  files: Record<string, number>;
}

/** The spec files of the suite, relative to the repository, sorted. */
export function specFiles(dir = 'e2e'): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.spec.ts'))
    .map((f) => `${dir}/${f}`)
    .sort();
}

/** A stable number of a text (FNV-1a, 32 bits). */
export function hashOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The part of a spec file: its place in the plan, else its hash. */
export function partOf(file: string, plan: Plan): number {
  const known = plan.files[file];
  if (known !== undefined && known >= 1 && known <= plan.parts) return known;
  return (hashOf(file) % plan.parts) + 1;
}

/** The spec files of part <part>. */
export function filesOf(part: number, files: string[], plan: Plan): string[] {
  if (!Number.isInteger(part) || part < 1 || part > plan.parts)
    throw new Error(`There are the parts 1 to ${plan.parts}, not ${part}.`);
  return files.filter((f) => partOf(f, plan) === part);
}

/** The time of all results of a suite's own specs, in ms. */
const ownTime = (suite: Suite): number =>
  (suite.specs ?? [])
    .flatMap((spec) => spec.tests ?? [])
    .flatMap((test) => test.results ?? [])
    .reduce((sum, result) => sum + (result.duration ?? 0), 0);

/** The time of every spec file in a JSON report of Playwright, in ms. */
export function timesOf(report: unknown): Map<string, number> {
  const times = new Map<string, number>();
  const visit = (suite: Suite, file: string): void => {
    const at = suite.file ? `e2e/${suite.file}` : file;
    times.set(at, (times.get(at) ?? 0) + ownTime(suite));
    for (const child of suite.suites ?? []) visit(child, at);
  };
  for (const suite of (report as { suites?: Suite[] }).suites ?? [])
    visit(suite, '');
  return times;
}

interface Suite {
  file?: string;
  specs?: { tests?: { results?: { duration?: number }[] }[] }[];
  suites?: Suite[];
}

/**
 * The plan for <parts> parts: the longest file first into the part with
 * the least time so far (a file without a time costs the mean), ties by
 * name, so the same times give the same plan.
 */
export function planOf(
  files: string[],
  times: Map<string, number>,
  parts = PARTS,
): Plan {
  const known = files.map((f) => times.get(f)).filter((t) => t !== undefined);
  const mean = known.length
    ? known.reduce((a, b) => a + b, 0) / known.length
    : 1;
  const cost = (f: string): number => times.get(f) ?? mean;
  const order = [...files].sort(
    (a, b) => cost(b) - cost(a) || a.localeCompare(b),
  );
  const load = Array.from({ length: parts }, () => 0);
  const plan: Plan = { parts, files: {} };
  for (const f of order) {
    const part = load.indexOf(Math.min(...load));
    load[part]! += cost(f);
    plan.files[f] = part + 1;
  }
  plan.files = Object.fromEntries(
    Object.entries(plan.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  return plan;
}

/** The time of every part of a plan, in ms. */
export function loadOf(plan: Plan, times: Map<string, number>): number[] {
  const load = Array.from({ length: plan.parts }, () => 0);
  for (const [f, part] of Object.entries(plan.files))
    load[part - 1]! += times.get(f) ?? 0;
  return load;
}

const readPlan = (): Plan =>
  JSON.parse(readFileSync(PLAN_FILE, 'utf8')) as Plan;

/** files <part> | plan <report.json>; the exit code. */
export function main([command, arg]: readonly string[]): number {
  if (command === 'files' && arg) {
    for (const f of filesOf(Number(arg), specFiles(), readPlan()))
      console.log(f);
    return 0;
  }
  if (command === 'plan' && arg) {
    const times = timesOf(JSON.parse(readFileSync(arg, 'utf8')));
    const plan = planOf(specFiles(), times);
    writeFileSync(PLAN_FILE, `${JSON.stringify(plan, null, 2)}\n`);
    const minutes = loadOf(plan, times).map((ms) => (ms / 60000).toFixed(1));
    console.log(`Parts: ${minutes.join(', ')} minutes`);
    return 0;
  }
  console.error(
    `Usage: e2e-shards.ts files <part> | plan <report.json> (${path.basename(PLAN_FILE)})`,
  );
  return 1;
}

if (import.meta.main) runCli(() => main(process.argv.slice(2)));
