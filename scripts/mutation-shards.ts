// Sharded mutation runs (owner, 2026-11-12, #131). Stryker runs in 4
// parallel jobs; this script splits the files it mutates between them and
// merges their reports again for the gate (scripts/mutation-gate.ts).
//
//   node scripts/mutation-shards.ts plan
//        prints the plan, a JSON list of 4 file lists: the files of the
//        "mutate" globs in stryker.config.json, weighed by their mutant
//        count in the last report (reports/mutation/mutation.json) or else
//        by their lines, largest first onto the emptiest shard
//   node scripts/mutation-shards.ts config <n>
//        writes the Stryker configuration of shard n (1 to 4) of the plan in
//        MUTATION_PLAN to reports/stryker-shard.config.json: the same
//        configuration with only its files and without the break threshold,
//        which the gate checks on the merged report; the incremental file
//        (reports/stryker-incremental.json) keeps only the shard's files
//   node scripts/mutation-shards.ts merge <out> <report>...
//        merges the shard reports into one (union of the files) and fails
//        unless each shard of the plan in MUTATION_PLAN ran exactly once
//        with exactly its files and reported only them
import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, matchesGlob } from 'node:path';
import { runCli } from './cli.ts';

export const SHARDS = 4;
const CONFIG = 'stryker.config.json';
const REPORT = 'reports/mutation/mutation.json';
const SHARD_CONFIG = 'reports/stryker-shard.config.json';
const INCREMENTAL = 'reports/stryker-incremental.json';

export interface Report {
  files: Record<string, { mutants: unknown[] }>;
  testFiles?: unknown;
  thresholds?: unknown;
  [key: string]: unknown;
}

interface StrykerConfig {
  mutate: string[];
  thresholds: { high: number; low: number; break: number | null };
  [key: string]: unknown;
}

/**
 * The files Stryker mutates: the patterns in their order, a pattern with "!"
 * removes what it matches. Sorted, so the plan does not depend on the order
 * of the file system.
 */
export function mutatedFiles(
  patterns: readonly string[],
  glob: (pattern: string) => string[] = (p) => globSync(p),
): string[] {
  let files: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      const exclude = pattern.slice(1);
      files = files.filter((f) => !matchesGlob(f, exclude));
    } else {
      files.push(...glob(pattern).map((f) => f.split('\\').join('/')));
    }
  }
  return [...new Set(files)].sort();
}

/** Weight of each file: its mutants in the last report, else its lines. */
export function weigh(
  files: readonly string[],
  report: Report | undefined,
  lines: (file: string) => number,
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const file of files) {
    const known = report?.files[file];
    weights[file] = known ? known.mutants.length : lines(file);
  }
  return weights;
}

/**
 * Greedy split: the heaviest file first onto the shard with the least
 * weight (the first of equal shards); equal weights in name order. Each
 * shard lists its files sorted. The same weights give the same plan.
 */
export function split(
  weights: Record<string, number>,
  shards = SHARDS,
): string[][] {
  const plan: string[][] = Array.from({ length: shards }, () => []);
  const load: number[] = new Array<number>(shards).fill(0);
  const order = Object.entries(weights).sort(
    ([a, wa], [b, wb]) => wb - wa || (a < b ? -1 : 1),
  );
  for (const [file, weight] of order) {
    const emptiest = load.indexOf(Math.min(...load));
    plan[emptiest]!.push(file);
    load[emptiest]! += weight;
  }
  return plan.map((files) => files.sort());
}

/** The Stryker configuration of shard n (1-based) of the plan. */
export function shardConfig(
  config: StrykerConfig,
  plan: readonly string[][],
  n: number,
): StrykerConfig {
  const files = plan[n - 1];
  if (!Number.isInteger(n) || !files)
    throw new Error(`No shard ${n} in a plan of ${plan.length} shards.`);
  const rest: StrykerConfig = { ...config };
  delete rest.$schema;
  return {
    ...rest,
    mutate: [...files],
    thresholds: { ...config.thresholds, break: null },
  };
}

function mutateOf(report: Report): string {
  const mutate = (report.config as { mutate?: unknown } | undefined)?.mutate;
  return Array.isArray(mutate)
    ? [...(mutate as string[])].sort().join('\n')
    : '';
}

/**
 * Only the files of one shard. Stryker keeps the results of every file in
 * its incremental file, also of files it does not mutate this time, and
 * reports them again; a file that moved to another shard would be reported
 * twice, with an old result. So each shard starts from its own files only.
 */
export function prune(report: Report, files: readonly string[]): Report {
  const own = new Set(files);
  return {
    ...report,
    files: Object.fromEntries(
      Object.entries(report.files).filter(([file]) => own.has(file)),
    ),
  };
}

/**
 * Problems of the shard reports against the plan; none means every shard
 * of the plan ran exactly once with exactly its files and reported only
 * them. Stryker leaves files without mutants out of its report, so each
 * report is matched to its shard by the "mutate" list it ran with.
 */
export function coverage(
  plan: readonly string[][],
  reports: readonly Report[],
): string[] {
  const shards = plan.map((files) => [...files].sort().join('\n'));
  const runs = plan.map(() => 0);
  const problems: string[] = [];
  reports.forEach((report, i) => {
    const shard = shards.indexOf(mutateOf(report));
    if (shard === -1) {
      problems.push(`report ${i + 1} ran files that are no shard of the plan`);
      return;
    }
    runs[shard]!++;
    for (const file of Object.keys(report.files))
      if (!plan[shard]!.includes(file))
        problems.push(
          `${file} is in the report of shard ${shard + 1}, not in its files`,
        );
  });
  runs.forEach((n, i) => {
    if (n !== 1) problems.push(`shard ${i + 1} has ${n} reports`);
  });
  return [...problems, ...duplicates(reports)];
}

function duplicates(reports: readonly Report[]): string[] {
  const seen = new Set<string>();
  const twice: string[] = [];
  for (const file of reports.flatMap((r) => Object.keys(r.files))) {
    if (seen.has(file)) twice.push(`${file} is in two shard reports`);
    seen.add(file);
  }
  return twice;
}

/**
 * One report with the files of all shards and the thresholds of
 * stryker.config.json. The test ids are numbered per shard and each shard
 * ran with its own configuration, so the merged report has neither
 * testFiles nor config; the gate needs the status of every mutant only.
 */
export function merge(
  reports: readonly Report[],
  thresholds: StrykerConfig['thresholds'],
): Report {
  const [first] = reports;
  if (!first) throw new Error('No report to merge.');
  const files: Report['files'] = {};
  for (const report of reports) Object.assign(files, report.files);
  const rest: Report = { ...first };
  delete rest.testFiles;
  delete rest.config;
  return { ...rest, thresholds, files };
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function readPlan(): string[][] {
  const plan = process.env.MUTATION_PLAN;
  if (!plan) throw new Error('MUTATION_PLAN is not set.');
  return JSON.parse(plan) as string[][];
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function lastReport(): Report | undefined {
  try {
    return readJson<Report>(REPORT);
  } catch {
    return undefined;
  }
}

function plan(): number {
  const config = readJson<StrykerConfig>(CONFIG);
  const report = lastReport();
  const files = mutatedFiles(config.mutate);
  const weights = weigh(
    files,
    report,
    (f) => readFileSync(f, 'utf8').split('\n').length,
  );
  const shards = split(weights);
  console.error(
    `${files.length} files, weighed by ${report ? 'their mutants in the last report, else their lines' : 'their lines (no last report)'}:`,
  );
  shards.forEach((s, i) => {
    const sum = s.reduce((total, f) => total + (weights[f] ?? 0), 0);
    console.error(`  shard ${i + 1}: ${s.length} files, weight ${sum}`);
  });
  console.log(JSON.stringify(shards));
  return 0;
}

function config(n: string | undefined): number {
  const shard = shardConfig(
    readJson<StrykerConfig>(CONFIG),
    readPlan(),
    Number(n),
  );
  writeJson(SHARD_CONFIG, shard);
  if (existsSync(INCREMENTAL))
    writeJson(INCREMENTAL, prune(readJson<Report>(INCREMENTAL), shard.mutate));
  console.log(
    `Shard ${n}: ${shard.mutate.length} files in ${SHARD_CONFIG}:\n  ${shard.mutate.join('\n  ')}`,
  );
  return 0;
}

function mergeReports(out: string | undefined, inputs: string[]): number {
  if (!out || inputs.length === 0) {
    console.error('Usage: mutation-shards.ts merge <out> <report>...');
    return 1;
  }
  const reports = inputs.map((f) => readJson<Report>(f));
  const problems = coverage(readPlan(), reports);
  for (const p of problems) console.log(`::error::Sharded mutation run: ${p}`);
  if (problems.length) return 1;
  const { thresholds } = readJson<StrykerConfig>(CONFIG);
  writeJson(out, merge(reports, thresholds));
  console.log(`${inputs.length} shard reports merged into ${out}.`);
  return 0;
}

function main(): number {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'plan') return plan();
  if (command === 'config') return config(args[0]);
  if (command === 'merge') return mergeReports(args[0], args.slice(1));
  console.error(
    'Usage: mutation-shards.ts plan | config <n> | merge <out> <report>...',
  );
  return 1;
}

if (import.meta.main) runCli(main);
