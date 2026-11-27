// The partial mutation run of a pull request (owner, 2026-11-18, #309). A
// pull request that is no release pull request and goes into no hotfix
// branch mutates only what it changes, at any size (owner, 2026-11-26, #370,
// 189a), instead of every file in the shards (about an hour with 6, 12 since
// 2026-11-20). The set holds
//   - the files of the "mutate" globs of stryker.config.json that the pull
//     request changed (a deleted file is gone, so it is not in the set), and
//   - for a changed test file the source file it tests, when that file is
//     mutated: the same name without ".test", also without the dotted
//     suffixes of the name (x.property.test.ts, x.routes.test.ts test x.ts),
//     a source with the ending ".svelte.ts" (state.test.ts tests
//     state.svelte.ts), and in src/test/ the script of the same name in
//     scripts/ (size-ratchet.test.ts tests scripts/size-ratchet.ts).
//   - the files whose floor in mutation-floors.txt was added, changed or
//     removed (a pull request that raises or adds a floor proves it in its
//     own run; a removed floor is checked against the new-file minimum); the
//     file holds nothing but floors, one line per file (#317 part 4, the
//     coordinator, 2026-11-18). A change of mutation-standard.json (newFile,
//     security) runs everything.
// A test file with no such source adds nothing, and neither does a test
// helper (src/test/** and src/server/test-helpers.ts that are no *.test.ts):
// the nightly complete run (mutation.yml) tests them. The set is split into
// parts of about PART_FILES files, by the measured weights as the shards
// are (#370, 190a); each part is a job, and their reports are merged and
// checked as one. A change of the mutation configuration (as
// scripts/mutation-changes.ts, #146, but mutation-floors.txt counts only as
// above) or of the versions of Stryker, Vitest or TypeScript in the lockfile
// still runs everything, in the shards.
//
//   node scripts/mutation-partial.ts plan <from> [<to>]
//        prints "true" when everything runs, else the JSON list of the
//        files to mutate ("[]": none, the mutation jobs are skipped); the
//        reasons on stderr
//   node scripts/mutation-partial.ts parts
//        prints the plan of the parts for the files of the JSON list in
//        MUTATION_FILES, a JSON list of lists of files: one part for each
//        PART_FILES files begun, at most SHARDS, split by the weights of
//        reports/mutation-state.json (the last complete run, restored read
//        only), else by their lines; whole files, no part empty
//   node scripts/mutation-partial.ts config <n>
//        writes reports/stryker-partial.config.json for part n (1-based) of
//        the plan in MUTATION_PLAN: the configuration of stryker.config.json
//        with only its files, no incremental file and no break threshold
//   node scripts/mutation-partial.ts merge <out> <report>...
//        merges the reports of the parts into <out> and fails unless each
//        part of the plan in MUTATION_PLAN ran exactly once with exactly its
//        files, as the merge of the shards checks it; <out> names all files
//        of the plan as the files Stryker ran, so that
//        scripts/mutation-gate.ts --partial checks it as one run
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runCli } from './cli.ts';
import {
  changedFiles,
  isMutated,
  lockfileReason,
  matchesAny,
  MUTATION_CONFIG,
  runGit,
} from './mutation-changes.ts';
import { FLOORS_FILE, parseFloors } from './mutation-floorfile.ts';
import {
  coverage,
  merge,
  type Report,
  shardConfig,
  SHARDS,
  split,
  stateOf,
  type StrykerConfig,
  weigh,
} from './mutation-shards.ts';

const TEST = '.test.ts';
const STRYKER = 'stryker.config.json';
const PARTIAL_CONFIG = 'reports/stryker-partial.config.json';
const STATE = 'reports/mutation-state.json';

/**
 * The files a test file may test, by name (they may not exist or not be
 * mutated); none for a file that is no *.test.ts.
 */
export function sources(file: string): string[] {
  if (!file.endsWith(TEST)) return [];
  const stem = file.slice(0, -TEST.length);
  const slash = stem.lastIndexOf('/') + 1;
  const dir = stem.slice(0, slash);
  let name = stem.slice(slash);
  const names = [name];
  // x.property -> x: every dotted suffix of the name may be left out.
  while (name.lastIndexOf('.') > 0) {
    name = name.slice(0, name.lastIndexOf('.'));
    names.push(name);
  }
  const places = dir === 'src/test/' ? [dir, 'scripts/'] : [dir];
  return places.flatMap((place) =>
    names.flatMap((n) => [`${place}${n}.ts`, `${place}${n}.svelte.ts`]),
  );
}

/**
 * The files to mutate for the changed files: the changed files that are
 * mutated and exist, and the mutated sources of the changed test files.
 * Sorted, without duplicates.
 */
export function partialSet(
  changed: readonly string[],
  mutate: readonly string[],
  exists: (file: string) => boolean,
): string[] {
  const set = new Set<string>();
  for (const file of changed)
    for (const f of [file, ...sources(file)])
      if (isMutated(f, mutate) && exists(f)) set.add(f);
  return [...set].sort();
}

/**
 * The files of one part of the partial run (#370, 190a, [V]): a set of more
 * files is split into more parts, one for each PART_FILES files begun, at
 * most SHARDS. Measured on 2026-11-19 (#309): one job of 11 files took 9
 * minutes, one of 33 files more than 60. The weights decide which files go
 * together, so a heavy file such as `catalog.ts` gets a part of its own.
 */
export const PART_FILES = 12;

/** The number of parts for a set of <count> files. */
export const partCount = (count: number): number =>
  Math.min(SHARDS, Math.max(1, Math.ceil(count / PART_FILES)));

/**
 * The plan of the parts of <files>: weighed as the shards are (the test time
 * of their mutants in <report>, a file it does not know as the mean file,
 * without a report by its lines), split greedily onto partCount parts, empty
 * parts left out. The same input gives the same plan.
 */
export function partsOf(
  files: readonly string[],
  report: Report | undefined,
  lines: (file: string) => number,
): string[][] {
  return split(weigh(files, report, lines), partCount(files.length)).filter(
    (part) => part.length > 0,
  );
}

/**
 * What a change of the floors file from <before> to <after> (its texts) runs:
 * the files whose floor was added, changed or removed. The file is nothing
 * but floors (mutation-floors.txt, one line per file), so that is all a
 * change of it can be; a file that is missing on either side (the change
 * that introduces it) or has a line of another form, or two lines for a
 * file, runs everything.
 */
export function floorChanges(
  before: string | undefined,
  after: string | undefined,
): { files: string[] } | { reason: string } {
  let was: Record<string, number>;
  let is: Record<string, number>;
  try {
    if (before === undefined || after === undefined)
      throw new Error(`${FLOORS_FILE} is not there on both sides`);
    was = parseFloors(before);
    is = parseFloors(after);
  } catch (error) {
    return {
      reason: `${FLOORS_FILE} is not of the form this script knows: ${(error as Error).message}`,
    };
  }
  const files = new Set([...Object.keys(was), ...Object.keys(is)]);
  return { files: [...files].filter((f) => was[f] !== is[f]).sort() };
}

/**
 * What the changes from <from> to <to> run: reasons to run everything (the
 * mutation configuration, mutation-standard.json included, or the test tool
 * chain changed, or mutation-floors.txt is not as floorChanges reads it),
 * else the files of the partial run. git
 * runs a git command and returns its output; exists tells whether a file is
 * in the checked-out tree.
 */
export function plan(
  from: string,
  to: string,
  mutate: readonly string[],
  git: (args: string[]) => string,
  exists: (file: string) => boolean,
): { reasons: string[]; files: string[] } {
  const changed = changedFiles(from, to, git);
  // mutation-floors.txt is a mutation configuration for the complete runs
  // (scripts/mutation-changes.ts), but here only its floors count; a change
  // of mutation-standard.json (newFile, security) runs everything.
  const config = MUTATION_CONFIG.filter((p) => p !== FLOORS_FILE);
  const reasons = changed
    .filter((f) => matchesAny(f, config))
    .map((f) => `${f} configures the mutation run`);
  const tools = lockfileReason(changed, from, to, git);
  if (tools) reasons.push(tools);
  let floors: string[] = [];
  if (changed.includes(FLOORS_FILE)) {
    const show = (rev: string): string | undefined => {
      try {
        return git(['show', `${rev}:${FLOORS_FILE}`]);
      } catch {
        return undefined;
      }
    };
    const found = floorChanges(show(from), show(to));
    if ('reason' in found) reasons.push(found.reason);
    else floors = found.files;
  }
  const files = reasons.length
    ? []
    : partialSet([...changed, ...floors], mutate, exists);
  return { reasons, files };
}

/** The files of the JSON list in MUTATION_FILES; a missing or empty one fails. */
export function filesOf(value: string | undefined): string[] {
  let files: unknown;
  try {
    files = JSON.parse(value ?? '');
  } catch {
    files = undefined;
  }
  if (
    !Array.isArray(files) ||
    files.length === 0 ||
    !files.every((f) => typeof f === 'string' && f !== '')
  )
    throw new Error('MUTATION_FILES is no JSON list of files.');
  return files as string[];
}

/** The plan of the parts in MUTATION_PLAN; a missing or broken one fails. */
export function partPlanOf(value: string | undefined): string[][] {
  let plan: unknown;
  try {
    plan = JSON.parse(value ?? '');
  } catch {
    plan = undefined;
  }
  if (
    !Array.isArray(plan) ||
    plan.length === 0 ||
    !plan.every(
      (part) =>
        Array.isArray(part) &&
        part.length > 0 &&
        part.every((f) => typeof f === 'string' && f !== ''),
    )
  )
    throw new Error('MUTATION_PLAN is no JSON list of parts of files.');
  return plan as string[][];
}

/** What the commands read and write; the defaults are the real ones. */
export interface Deps {
  git: (args: string[]) => string;
  exists: (file: string) => boolean;
  read: (file: string) => string;
  write: (file: string, text: string) => void;
  files: string | undefined;
  plan: string | undefined;
}

const real: Omit<Deps, 'files' | 'plan'> = {
  git: runGit,
  exists: existsSync,
  read: (file) => readFileSync(file, 'utf8'),
  write: (file, text) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  },
};

function planCommand([from, to = 'HEAD']: readonly string[], d: Deps): number {
  if (!from) {
    console.error('Usage: mutation-partial.ts plan <from> [<to>]');
    return 1;
  }
  const mutate = (JSON.parse(d.read(STRYKER)) as { mutate: string[] }).mutate;
  const found = plan(from, to, mutate, d.git, d.exists);
  for (const r of found.reasons) console.error(`Complete mutation run: ${r}`);
  if (found.reasons.length) {
    console.log('true');
    return 0;
  }
  console.error(
    found.files.length
      ? `Mutation run for the changed files: ${found.files.join(', ')}`
      : 'No mutated file, source of a changed test file, mutation configuration or test tool chain changed: the mutation jobs are skipped.',
  );
  console.log(JSON.stringify(found.files));
  return 0;
}

/** The configuration of the partial run of <files> (no incremental file, no break). */
export function partialConfig(
  config: StrykerConfig,
  files: readonly string[],
): StrykerConfig {
  return { ...shardConfig(config, [[...files]], 1), incremental: false };
}

/** The weights of the last complete run, when the state was restored. */
function lastWeights(d: Deps): Report | undefined {
  if (!d.exists(STATE)) return undefined;
  try {
    return stateOf(JSON.parse(d.read(STATE)))?.weights;
  } catch {
    return undefined;
  }
}

function partsCommand(d: Deps): number {
  const files = filesOf(d.files);
  const weights = lastWeights(d);
  const plan = partsOf(files, weights, (f) => d.read(f).split('\n').length);
  console.error(
    `${files.length} files in ${plan.length} parts, weighed by ${weights ? 'the weights of the last complete run' : 'their lines (no state of a complete run)'}:`,
  );
  plan.forEach((part, i) =>
    console.error(`  part ${i + 1}: ${part.join(', ')}`),
  );
  console.log(JSON.stringify(plan));
  return 0;
}

function configCommand([n]: readonly string[], d: Deps): number {
  const plan = partPlanOf(d.plan);
  const part = Number(n);
  const files = plan[part - 1];
  if (!Number.isInteger(part) || !files)
    throw new Error(`No part ${n} in a plan of ${plan.length} parts.`);
  const config = JSON.parse(d.read(STRYKER)) as StrykerConfig;
  d.write(
    PARTIAL_CONFIG,
    `${JSON.stringify(partialConfig(config, files), null, 2)}\n`,
  );
  console.log(
    `Part ${part} of ${plan.length}: ${files.length} files in ${PARTIAL_CONFIG}:\n  ${files.join('\n  ')}`,
  );
  return 0;
}

/**
 * The reports of the parts of <plan> as one report of the partial run, or
 * the problems: every part ran once with exactly its files (coverage of the
 * shards). The merged report names all files of the plan as the files
 * Stryker ran.
 */
export function mergeParts(
  plan: readonly string[][],
  reports: readonly Report[],
  thresholds: StrykerConfig['thresholds'],
): { report: Report } | { problems: string[] } {
  const problems = coverage(plan, reports);
  if (problems.length) return { problems };
  return {
    report: {
      ...merge(reports, thresholds),
      config: { mutate: plan.flat().sort() },
    },
  };
}

function mergeCommand([out, ...inputs]: readonly string[], d: Deps): number {
  if (!out || inputs.length === 0) {
    console.error('Usage: mutation-partial.ts merge <out> <report>...');
    return 1;
  }
  const plan = partPlanOf(d.plan);
  const reports = inputs.map((f) => JSON.parse(d.read(f)) as Report);
  const { thresholds } = JSON.parse(d.read(STRYKER)) as StrykerConfig;
  const merged = mergeParts(plan, reports, thresholds);
  if ('problems' in merged) {
    for (const p of merged.problems)
      console.log(`::error::Partial mutation run: ${p}`);
    return 1;
  }
  d.write(out, `${JSON.stringify(merged.report, null, 2)}\n`);
  console.log(`${inputs.length} reports of the parts merged into ${out}.`);
  return 0;
}

/** Runs a command; see the head of the file. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  deps: Partial<Deps> = {},
): number {
  const [command, ...rest] = args;
  const d = {
    ...real,
    files: process.env.MUTATION_FILES,
    plan: process.env.MUTATION_PLAN,
    ...deps,
  };
  if (command === 'plan') return planCommand(rest, d);
  if (command === 'parts') return partsCommand(d);
  if (command === 'config') return configCommand(rest, d);
  if (command === 'merge') return mergeCommand(rest, d);
  console.error(
    'Usage: mutation-partial.ts plan <from> [<to>] | parts | config <n> | merge <out> <report>...',
  );
  return 1;
}

if (import.meta.main) runCli(() => main());
