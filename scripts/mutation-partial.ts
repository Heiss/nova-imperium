// The partial mutation run of a pull request (owner, 2026-11-18, #309). A
// pull request that is no release pull request and goes into no hotfix
// branch mutates only what it changes, in one job, instead of every file in
// 6 shards (about an hour). The set holds
//   - the files of the "mutate" globs of stryker.config.json that the pull
//     request changed (a deleted file is gone, so it is not in the set), and
//   - for a changed test file the source file it tests, when that file is
//     mutated: the same name without ".test", also without the dotted
//     suffixes of the name (x.property.test.ts, x.routes.test.ts test x.ts),
//     a source with the ending ".svelte.ts" (state.test.ts tests
//     state.svelte.ts), and in src/test/ the script of the same name in
//     scripts/ (size-ratchet.test.ts tests scripts/size-ratchet.ts).
//   - the files whose floor in mutation-standard.json was added, changed or
//     removed, when only the floors changed (a pull request that raises or
//     adds a floor proves it in its own run; a removed floor is checked
//     against the new-file minimum); any other change of that file runs
//     everything (#309, the coordinator, 2026-11-18).
// A test file with no such source adds nothing, and neither does a test
// helper (src/test/** and src/server/test-helpers.ts that are no *.test.ts):
// the nightly complete run (mutation.yml) tests them. A set of more than
// PARTIAL_LIMIT files runs everything too: one job is slower than the shards
// for it (#309). A change of the
// mutation configuration (as scripts/mutation-changes.ts, #146, but
// mutation-standard.json counts only as above) or of the versions of Stryker, Vitest or TypeScript in the lockfile still runs
// everything, in the 6 shards.
//
//   node scripts/mutation-partial.ts plan <from> [<to>]
//        prints "true" when everything runs, else the JSON list of the
//        files to mutate ("[]": none, the mutation jobs are skipped); the
//        reasons on stderr
//   node scripts/mutation-partial.ts config
//        writes reports/stryker-partial.config.json for the files of the
//        JSON list in MUTATION_FILES: the configuration of
//        stryker.config.json with only these files, no incremental file and
//        no break threshold (scripts/mutation-gate.ts --partial checks the
//        report)
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
import { shardConfig, type StrykerConfig } from './mutation-shards.ts';

const TEST = '.test.ts';
const STRYKER = 'stryker.config.json';
const PARTIAL_CONFIG = 'reports/stryker-partial.config.json';

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
 * The most files one partial job mutates; a set above it runs the complete
 * run in 6 shards (the coordinator, 2026-11-19, #309). One job has no cache
 * and no parallel jobs, so its time grows with the number of files while the
 * complete run takes about 60 minutes whatever the set. Measured on
 * 2026-11-19: the partial run of #281 (11 files, among them `types.ts` and
 * `index.ts` without mutants) took 9 minutes, that of #318 (33 files) more
 * than 60 without an end. 12 is the first number above the largest set seen
 * to be fast; it is a count, not a weight [V]: a few big files such as
 * `catalog.ts` can be slower than many small ones.
 */
export const PARTIAL_LIMIT = 12;
const STANDARD = 'mutation-standard.json';
/** The keys of mutation-standard.json (scripts/mutation-gate.ts, Standard). */
const STANDARD_KEYS = ['floors', 'newFile', 'security', 'securityTarget'];

/** A plain JSON object, or undefined for text that is none. */
function objectOf(
  text: string | undefined,
): Record<string, unknown> | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text ?? '');
  } catch {
    return undefined;
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** The floors of a parsed mutation-standard.json: a plain object of numbers. */
function floorsOf(
  standard: Record<string, unknown>,
): Record<string, number> | undefined {
  const floors = standard.floors;
  return typeof floors === 'object' &&
    floors !== null &&
    !Array.isArray(floors) &&
    Object.values(floors).every((v) => typeof v === 'number')
    ? (floors as Record<string, number>)
    : undefined;
}

/**
 * What a change of mutation-standard.json from <before> to <after> (the
 * texts of the file) runs: the files whose floor was added, changed or
 * removed when ONLY floors changed, else the reason to run everything. Only
 * floors changed when both texts are JSON objects with exactly the keys
 * floors, newFile, security and securityTarget, each floor is a number, and
 * newFile, security and securityTarget are equal on both sides (compared as
 * JSON, so a changed order of "security" counts as a change). A file that is
 * missing or no such object on either side runs everything.
 */
export function floorChanges(
  before: string | undefined,
  after: string | undefined,
): { files: string[] } | { reason: string } {
  const old = objectOf(before);
  const now = objectOf(after);
  const known = (o: Record<string, unknown> | undefined): boolean =>
    o !== undefined &&
    Object.keys(o).sort().join() === STANDARD_KEYS.join() &&
    floorsOf(o) !== undefined;
  if (!old || !now || !known(old) || !known(now))
    return { reason: `${STANDARD} is not of the form this script knows` };
  const other = STANDARD_KEYS.filter(
    (k) => k !== 'floors' && JSON.stringify(old[k]) !== JSON.stringify(now[k]),
  );
  if (other.length)
    return {
      reason: `${STANDARD} changes more than the floors: ${other.join(', ')}`,
    };
  const was = floorsOf(old)!;
  const is = floorsOf(now)!;
  const files = new Set([...Object.keys(was), ...Object.keys(is)]);
  return { files: [...files].filter((f) => was[f] !== is[f]).sort() };
}

/**
 * What the changes from <from> to <to> run: reasons to run everything (the
 * mutation configuration or the test tool chain changed, or more than the
 * floors of mutation-standard.json), else the files of the partial run. git
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
  // mutation-standard.json is a mutation configuration for the complete
  // runs (scripts/mutation-changes.ts), but here only its floors count.
  const config = MUTATION_CONFIG.filter((p) => p !== STANDARD);
  const reasons = changed
    .filter((f) => matchesAny(f, config))
    .map((f) => `${f} configures the mutation run`);
  const tools = lockfileReason(changed, from, to, git);
  if (tools) reasons.push(tools);
  let floors: string[] = [];
  if (changed.includes(STANDARD)) {
    const show = (rev: string): string | undefined => {
      try {
        return git(['show', `${rev}:${STANDARD}`]);
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
  if (files.length > PARTIAL_LIMIT)
    return {
      reasons: [
        `${files.length} changed files are more than the limit of ${PARTIAL_LIMIT} for one job`,
      ],
      files: [],
    };
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

/** What the commands read and write; the defaults are the real ones. */
export interface Deps {
  git: (args: string[]) => string;
  exists: (file: string) => boolean;
  read: (file: string) => string;
  write: (file: string, text: string) => void;
  files: string | undefined;
}

const real: Omit<Deps, 'files'> = {
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

function configCommand(d: Deps): number {
  const files = filesOf(d.files);
  const config = JSON.parse(d.read(STRYKER)) as StrykerConfig;
  d.write(
    PARTIAL_CONFIG,
    `${JSON.stringify(partialConfig(config, files), null, 2)}\n`,
  );
  console.log(
    `${files.length} files in ${PARTIAL_CONFIG}:\n  ${files.join('\n  ')}`,
  );
  return 0;
}

/** Runs a command; see the head of the file. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  deps: Partial<Deps> = {},
): number {
  const [command, ...rest] = args;
  const d = { ...real, files: process.env.MUTATION_FILES, ...deps };
  if (command === 'plan') return planCommand(rest, d);
  if (command === 'config') return configCommand(d);
  console.error('Usage: mutation-partial.ts plan <from> [<to>] | config');
  return 1;
}

if (import.meta.main) runCli(() => main());
