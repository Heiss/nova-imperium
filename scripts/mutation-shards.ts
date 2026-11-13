// Sharded mutation runs (owner, 2026-11-12, #131). Stryker runs in 4
// parallel jobs; this script splits the files it mutates between them and
// merges their reports again for the gate (scripts/mutation-gate.ts).
//
//   node scripts/mutation-shards.ts plan
//        prints the plan, a JSON list of 6 lists of "mutate" entries: the
//        files of the "mutate" globs in stryker.config.json, weighed by the
//        test time of their mutants in the last report
//        (reports/mutation/mutation.json) or else by their lines; a file
//        heavier than half a shard is cut into line ranges between its
//        top-level statements ("file:from-to"); the heaviest first onto the
//        emptiest shard (owner, 2026-11-13, #131)
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
import { createRequire } from 'node:module';
import { dirname, matchesGlob } from 'node:path';
import type * as TS from 'typescript';
import { runCli } from './cli.ts';

export const SHARDS = 6;
const CONFIG = 'stryker.config.json';
const REPORT = 'reports/mutation/mutation.json';
const SHARD_CONFIG = 'reports/stryker-shard.config.json';
const INCREMENTAL = 'reports/stryker-incremental.json';

/** The fields of a mutant the plan and the merge read. */
export interface Mutant {
  /** Milliseconds Stryker spent testing it. */
  duration?: number;
  /** Code run when the module loads: every test runs again for it. */
  static?: boolean;
  mutatorName?: string;
  replacement?: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  [key: string]: unknown;
}

export interface Report {
  files: Record<
    string,
    { mutants: Mutant[]; source?: string; [key: string]: unknown }
  >;
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

/**
 * The cost of a mutant in the last report: the milliseconds Stryker spent
 * on it. A mutant without a time costs the mean of its kind (static or
 * not); a report without any time counts each mutant as 1, as before. A
 * line of a file the report does not know costs as much as a mutant that
 * is not static (about one mutant a line).
 */
export function costs(report: Report | undefined): {
  mutant: (m: Mutant) => number;
  line: number;
} {
  const all = Object.values(report?.files ?? {}).flatMap((f) => f.mutants);
  const mean = (ms: Mutant[]): number | undefined => {
    const timed = ms.filter((m) => typeof m.duration === 'number');
    return timed.length
      ? timed.reduce((t, m) => t + m.duration!, 0) / timed.length
      : undefined;
  };
  const other = mean(all.filter((m) => !m.static));
  const fixed = mean(all.filter((m) => m.static)) ?? other;
  const any = mean(all);
  if (any === undefined) return { mutant: () => 1, line: 1 };
  return {
    mutant: (m) =>
      typeof m.duration === 'number'
        ? m.duration
        : ((m.static ? fixed : other) ?? any),
    line: other ?? any,
  };
}

/** Weight of each file: the cost of its mutants in the last report, else of its lines. */
export function weigh(
  files: readonly string[],
  report: Report | undefined,
  lines: (file: string) => number,
): Record<string, number> {
  const cost = costs(report);
  const weights: Record<string, number> = {};
  for (const file of files) {
    const known = report?.files[file];
    weights[file] = known
      ? known.mutants.reduce((t, m) => t + cost.mutant(m), 0)
      : lines(file) * cost.line;
  }
  return weights;
}

const RANGE = /^(.*):(\d+)-(\d+)$/;

/** A "mutate" entry: a whole file, or its lines from-to (1-based, inclusive). */
export function entryOf(entry: string): {
  file: string;
  from?: number;
  to?: number;
} {
  const m = RANGE.exec(entry);
  return m
    ? { file: m[1]!, from: Number(m[2]), to: Number(m[3]) }
    : { file: entry };
}

/**
 * The lines after which a file can be cut: the end of each top-level
 * statement that the next one does not share. Stryker mutates a node only
 * when it lies wholly in one range of its "mutate" entry; a node never
 * spans two top-level statements, so a cut between them loses no mutant.
 */
export function cuts(file: string, source: string): number[] {
  // Loaded only to cut a file: the merge in the gate job runs without
  // the dependencies.
  const ts = createRequire(import.meta.url)('typescript') as typeof TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const line = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const at: number[] = [];
  sf.statements.forEach((statement, i) => {
    const next = sf.statements[i + 1];
    if (!next) return;
    const end = line(statement.end);
    if (line(next.getStart(sf)) > end) at.push(end);
  });
  return at;
}

/**
 * A file cut into line ranges that cover it completely, each weighed by
 * the cost of the mutants of the last report that start in it. A piece
 * without cost joins its neighbour (the one before it, the first ones the
 * one after them), so a shard does not collect scattered empty ranges.
 */
export function pieces(
  file: string,
  source: string,
  mutants: readonly Mutant[],
  cost: (m: Mutant) => number,
): Record<string, number> {
  const bounds = [0, ...cuts(file, source), source.split('\n').length];
  const list: [number, number, number][] = [];
  for (let i = 1; i < bounds.length; i++) {
    const from = bounds[i - 1]! + 1;
    const to = bounds[i]!;
    const weight = mutants
      .filter((m) => {
        const start = m.location?.start.line ?? 0;
        return start >= from && start <= to;
      })
      .reduce((t, m) => t + cost(m), 0);
    const last = list.at(-1);
    if (last && (weight === 0 || last[2] === 0)) {
      last[1] = to;
      last[2] += weight;
    } else list.push([from, to, weight]);
  }
  return Object.fromEntries(
    list.map(([from, to, weight]) => [`${file}:${from}-${to}`, weight]),
  );
}

/**
 * The units of the split: every file, but a TypeScript file heavier than
 * half a shard is replaced by its pieces, so no shard waits on one file.
 */
export function units(
  weights: Record<string, number>,
  report: Report | undefined,
  read: (file: string) => string,
  shards = SHARDS,
): Record<string, number> {
  const total = Object.values(weights).reduce((t, w) => t + w, 0);
  const limit = total / shards / 2;
  const cost = costs(report).mutant;
  const result: Record<string, number> = {};
  for (const [file, weight] of Object.entries(weights)) {
    const source = file.endsWith('.ts') && weight > limit ? read(file) : '';
    const parts = source
      ? pieces(file, source, report?.files[file]?.mutants ?? [], cost)
      : {};
    if (Object.keys(parts).length > 1) Object.assign(result, parts);
    else result[file] = weight;
  }
  return result;
}

type Lines = [number, number];

/** The line ranges of the cut files in a list of "mutate" entries. */
function cutRanges(entries: readonly string[]): Map<string, Lines[]> {
  const ranges = new Map<string, Lines[]>();
  for (const e of entries) {
    const { file, from, to } = entryOf(e);
    if (from !== undefined && to !== undefined)
      ranges.set(file, [...(ranges.get(file) ?? []), [from, to]]);
  }
  return ranges;
}

/** Sorted ranges, neighbours joined into one. */
function joinRanges(list: readonly Lines[]): Lines[] {
  const joined: Lines[] = [];
  for (const [from, to] of [...list].sort((a, b) => a[0] - b[0])) {
    const prev = joined.at(-1);
    if (prev && prev[1] + 1 === from) prev[1] = to;
    else joined.push([from, to]);
  }
  return joined;
}

/**
 * Pieces of one file on the same shard become one range, and a file whose
 * pieces all landed on one shard becomes the whole file again.
 */
export function join(plan: readonly string[][]): string[][] {
  const shardsOf = new Map<string, number>();
  for (const entries of plan)
    for (const file of cutRanges(entries).keys())
      shardsOf.set(file, (shardsOf.get(file) ?? 0) + 1);
  return plan.map((entries) => {
    const ranges = cutRanges(entries);
    const result = entries.filter((e) => entryOf(e).from === undefined);
    for (const [file, list] of ranges) {
      if (shardsOf.get(file) === 1) result.push(file);
      else
        for (const [from, to] of joinRanges(list))
          result.push(`${file}:${from}-${to}`);
    }
    return result.sort();
  });
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

/** Per file of a list of "mutate" entries: its line ranges, or null for all of it. */
function rangesOf(entries: readonly string[]): Map<string, Lines[] | null> {
  const result = new Map<string, Lines[] | null>();
  for (const e of entries) {
    const { file, from, to } = entryOf(e);
    if (from === undefined || to === undefined) result.set(file, null);
    else if (result.get(file) !== null)
      result.set(file, [...(result.get(file) ?? []), [from, to]]);
  }
  return result;
}

function inside(m: Mutant, ranges: Lines[] | null): boolean {
  if (!ranges) return true;
  const start = m.location?.start.line ?? 0;
  const end = m.location?.end.line ?? start;
  return ranges.some(([from, to]) => start >= from && end <= to);
}

/**
 * Only the files and lines of one shard. Stryker keeps the results of
 * every file in its incremental file, also of files it does not mutate this
 * time, and reports them again; a file that moved to another shard would
 * be reported twice, with an old result. So each shard starts from its own
 * files only, and of a file cut into ranges from the mutants in its ranges.
 */
export function prune(
  report: Report,
  entries: readonly string[],
  source: (file: string) => string | undefined = () => undefined,
): Report {
  const own = rangesOf(entries);
  const files: Report['files'] = {};
  for (const [file, f] of Object.entries(report.files)) {
    if (!own.has(file)) continue;
    const ranges = own.get(file);
    if (!ranges) files[file] = f;
    // Stryker moves the cached mutants of a changed file to their new lines
    // and reports a moved one outside the ranges again; the cached lines
    // say nothing then, so a changed cut file starts without its cache.
    else if (f.source !== undefined && f.source === source(file))
      files[file] = {
        ...f,
        mutants: f.mutants.filter((m) => inside(m, ranges)),
      };
  }
  return { ...report, files };
}

/** Lines of one cut file in no shard or in two. */
function gaps(file: string, list: readonly Lines[], last?: number): string[] {
  const problems: string[] = [];
  let next = 1;
  for (const [from, to] of [...list].sort((a, b) => a[0] - b[0])) {
    if (from > next)
      problems.push(`${file}: lines ${next}-${from - 1} are in no shard`);
    if (from < next)
      problems.push(
        `${file}: lines ${from}-${Math.min(to, next - 1)} are in two shards`,
      );
    next = Math.max(next, to + 1);
  }
  if (last !== undefined && next <= last)
    problems.push(`${file}: lines ${next}-${last} are in no shard`);
  return problems;
}

/**
 * Gaps and overlaps of the files the plan cuts into ranges: together their
 * ranges must cover each such file from line 1 to its last line once.
 */
function cutProblems(
  plan: readonly string[][],
  lines?: (file: string) => number,
): string[] {
  const all = plan.flat();
  return [...cutRanges(all)].flatMap(([file, list]) => [
    ...(all.includes(file)
      ? [`${file} is in the plan whole and in ranges`]
      : []),
    ...gaps(file, list, lines?.(file)),
  ]);
}

/**
 * Problems of the shard reports against the plan; none means every shard
 * of the plan ran exactly once with exactly its entries, reported only its
 * files and, of a file cut into ranges, only mutants in its ranges, and no
 * mutant is reported twice. Stryker leaves files without mutants out of
 * its report, so each report is matched to its shard by the "mutate" list
 * it ran with. With the lines of the files, a cut file must be covered to
 * its last line.
 */
export function coverage(
  plan: readonly string[][],
  reports: readonly Report[],
  lines?: (file: string) => number,
): string[] {
  const shards = plan.map((entries) => [...entries].sort().join('\n'));
  const runs = plan.map(() => 0);
  const problems: string[] = [];
  reports.forEach((report, i) => {
    const shard = shards.indexOf(mutateOf(report));
    if (shard === -1) {
      problems.push(`report ${i + 1} ran files that are no shard of the plan`);
      return;
    }
    runs[shard]!++;
    const own = rangesOf(plan[shard]!);
    for (const [file, f] of Object.entries(report.files)) {
      if (!own.has(file)) {
        problems.push(
          `${file} is in the report of shard ${shard + 1}, not in its files`,
        );
        continue;
      }
      const outside = f.mutants.filter((m) => !inside(m, own.get(file)!));
      if (outside.length)
        problems.push(
          `${file}: ${outside.length} mutants in the report of shard ${shard + 1} are outside its lines`,
        );
    }
  });
  runs.forEach((n, i) => {
    if (n !== 1) problems.push(`shard ${i + 1} has ${n} reports`);
  });
  return [
    ...problems,
    ...cutProblems(plan, lines),
    ...duplicates(plan, reports),
  ];
}

const keyOf = (m: Mutant): string => {
  const l = m.location;
  return `${l?.start.line}:${l?.start.column}-${l?.end.line}:${l?.end.column} ${m.mutatorName} ${m.replacement}`;
};

/**
 * A file in two reports is a problem unless the plan cuts it into ranges;
 * then no mutant may be in two reports.
 */
function duplicates(
  plan: readonly string[][],
  reports: readonly Report[],
): string[] {
  const cut = new Set(cutRanges(plan.flat()).keys());
  // A whole file is reported once; a cut file once per mutant.
  const keys = (
    file: string,
    f: Report['files'][string],
  ): [string, string][] =>
    cut.has(file)
      ? f.mutants.map((m) => [
          `${file} ${keyOf(m)}`,
          `${file}: the mutant ${keyOf(m)} is in two shard reports`,
        ])
      : [[file, `${file} is in two shard reports`]];
  const seen = new Set<string>();
  const twice: string[] = [];
  for (const report of reports)
    for (const [file, f] of Object.entries(report.files))
      for (const [key, problem] of keys(file, f)) {
        if (seen.has(key)) twice.push(problem);
        seen.add(key);
      }
  return twice;
}

/**
 * One report with the files of all shards and the thresholds of
 * stryker.config.json; the mutants of a file cut into ranges are joined.
 * The test ids are numbered per shard and each shard ran with its own
 * configuration, so the merged report has neither testFiles nor config;
 * the gate needs the status of every mutant only.
 */
export function merge(
  reports: readonly Report[],
  thresholds: StrykerConfig['thresholds'],
): Report {
  const [first] = reports;
  if (!first) throw new Error('No report to merge.');
  const files: Report['files'] = {};
  for (const report of reports)
    for (const [file, f] of Object.entries(report.files)) {
      const known = files[file];
      files[file] = known
        ? { ...known, mutants: [...known.mutants, ...f.mutants] }
        : f;
    }
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

const read = (file: string): string => readFileSync(file, 'utf8');
const lineCount = (file: string): number => read(file).split('\n').length;

function plan(): number {
  const config = readJson<StrykerConfig>(CONFIG);
  const report = lastReport();
  const files = mutatedFiles(config.mutate);
  const weights = units(weigh(files, report, lineCount), report, read);
  const shards = join(split(weights));
  console.error(
    `${files.length} files, weighed by ${report ? 'the test time of their mutants in the last report, else their lines' : 'their lines (no last report)'}:`,
  );
  shards.forEach((s, i) => {
    const sum = Object.entries(weights)
      .filter(([unit]) => s.some((e) => covers(e, unit)))
      .reduce((total, [, w]) => total + w, 0);
    const cut = s.filter((e) => entryOf(e).from !== undefined);
    console.error(
      `  shard ${i + 1}: ${s.length} entries, weight ${Math.round(sum)}${cut.length ? ` (${cut.join(', ')})` : ''}`,
    );
  });
  console.log(JSON.stringify(shards));
  return 0;
}

/** Whether a joined entry of the plan holds a unit of the split. */
function covers(entry: string, unit: string): boolean {
  const e = entryOf(entry);
  const u = entryOf(unit);
  if (e.file !== u.file) return false;
  if (e.from === undefined || u.from === undefined) return true;
  return u.from >= e.from && u.to! <= e.to!;
}

function config(n: string | undefined): number {
  const shard = shardConfig(
    readJson<StrykerConfig>(CONFIG),
    readPlan(),
    Number(n),
  );
  writeJson(SHARD_CONFIG, shard);
  if (existsSync(INCREMENTAL))
    writeJson(
      INCREMENTAL,
      prune(readJson<Report>(INCREMENTAL), shard.mutate, (f) =>
        existsSync(f) ? read(f) : undefined,
      ),
    );
  console.log(
    `Shard ${n}: ${shard.mutate.length} entries in ${SHARD_CONFIG}:\n  ${shard.mutate.join('\n  ')}`,
  );
  return 0;
}

function mergeReports(out: string | undefined, inputs: string[]): number {
  if (!out || inputs.length === 0) {
    console.error('Usage: mutation-shards.ts merge <out> <report>...');
    return 1;
  }
  const reports = inputs.map((f) => readJson<Report>(f));
  const problems = coverage(readPlan(), reports, lineCount);
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
