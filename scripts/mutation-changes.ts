// Whether a pull request runs the mutation jobs (owner, 2026-11-13, #146).
// They run when the diff touches a file Stryker mutates (the "mutate" globs
// of stryker.config.json), a test file, the mutation configuration, or the
// versions of the test tool chain in pnpm-lock.yaml. Other changes (for
// example a dependency update or the Dockerfile) leave the mutants and the
// tests as they were; Stryker's incremental mode would not even notice them
// ("Stryker will not detect any changes you've made in files other than
// mutated files and test files", stryker-mutator.io/docs/stryker-js/incremental).
// The nightly complete run (mutation.yml) and every push to main and
// hotfix/** still run them.
//
//   node scripts/mutation-changes.ts <from> [<to>]
//        prints "true" or "false" for the changes from <from> to <to>
//        (default HEAD), the reasons on stderr
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { runCli } from './cli.ts';

const CONFIG = 'stryker.config.json';
export const LOCKFILE = 'pnpm-lock.yaml';

/**
 * Test files: what Vitest runs (test.include of vitest.config.ts) and the
 * test helpers it imports (as in .dependency-cruiser.cjs).
 */
export const TEST_FILES = [
  'src/**/*.test.ts',
  'src/test/**',
  'src/server/test-helpers.ts',
];

/** The configuration of the mutation run and its gate. */
export const MUTATION_CONFIG = [
  'stryker.config.json',
  'mutation-standard.json',
  'vitest.config.ts',
  'scripts/mutation-*.ts',
  'tsconfig.json',
];

/** Packages whose update can change the mutation results. */
export const TOOL_CHAIN = ['@stryker-mutator/*', 'vitest', 'typescript'];

export const matchesAny = (
  path: string,
  patterns: readonly string[],
): boolean => patterns.some((p) => matchesGlob(path, p));

/**
 * Whether Stryker mutates the file: the "mutate" patterns in their order, the
 * last one that matches decides, and a pattern with "!" removes (as
 * mutatedFiles in scripts/mutation-shards.ts). Works for deleted files too.
 */
export function isMutated(file: string, patterns: readonly string[]): boolean {
  let mutated = false;
  for (const pattern of patterns) {
    const exclude = pattern.startsWith('!');
    if (matchesGlob(file, exclude ? pattern.slice(1) : pattern))
      mutated = !exclude;
  }
  return mutated;
}

/** Why a changed file runs the mutation jobs, or undefined. */
export function reason(
  file: string,
  mutate: readonly string[],
): string | undefined {
  if (isMutated(file, mutate)) return `${file} is mutated (${CONFIG})`;
  if (matchesAny(file, TEST_FILES)) return `${file} is a test file`;
  if (matchesAny(file, MUTATION_CONFIG))
    return `${file} configures the mutation run`;
  return undefined;
}

const KEY = /^ {2}'?((?:@[^\s/@']+\/)?[^\s@'(]+)@([^\s'(:]+)/;

/**
 * The versions of the test tool chain in a pnpm lockfile (version 9): the
 * keys "name@version" of its section "packages", sorted.
 */
export function toolChain(lockfile: string): string[] {
  const found = new Set<string>();
  let packages = false;
  for (const line of lockfile.split('\n')) {
    if (/^\S/.test(line)) packages = line === 'packages:';
    const key = KEY.exec(line);
    if (packages && key && matchesAny(key[1]!, TOOL_CHAIN))
      found.add(`${key[1]}@${key[2]}`);
  }
  return [...found].sort();
}

/**
 * Why the lockfile change runs the mutation jobs: the tool chain versions it
 * removes and adds, or undefined. Fails when the new lockfile names no
 * version of a tool, so a changed format never skips the run unnoticed.
 */
export function toolChainReason(
  before: string,
  after: string,
): string | undefined {
  const old = toolChain(before);
  const now = toolChain(after);
  const missing = TOOL_CHAIN.filter(
    (tool) =>
      !now.some((v) => matchesGlob(v.slice(0, v.lastIndexOf('@')), tool)),
  );
  if (missing.length)
    throw new Error(
      `${LOCKFILE} names no version of ${missing.join(', ')}: cannot tell whether the test tool chain changed.`,
    );
  const changes = [
    ...old.filter((v) => !now.includes(v)).map((v) => `-${v}`),
    ...now.filter((v) => !old.includes(v)).map((v) => `+${v}`),
  ];
  return changes.length
    ? `${LOCKFILE} changes the test tool chain: ${changes.join(' ')}`
    : undefined;
}

/**
 * Every reason the changes from <from> to <to> run the mutation jobs; none
 * means they are skipped. git runs a git command and returns its output.
 */
export function reasons(
  from: string,
  to: string,
  mutate: readonly string[],
  git: (args: string[]) => string,
): string[] {
  // Without rename detection a moved file shows its old and new path; -z
  // keeps paths with unusual characters unquoted.
  const files = git([
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    from,
    to,
  ]).split('\0');
  const found = files.flatMap((f) => reason(f, mutate) ?? []);
  if (files.includes(LOCKFILE)) {
    const show = (rev: string): string => {
      try {
        return git(['show', `${rev}:${LOCKFILE}`]);
      } catch {
        return '';
      }
    };
    const tools = toolChainReason(show(from), show(to));
    if (tools) found.push(tools);
  }
  return found;
}

const runGit = (args: string[]): string =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

/** Prints "true" or "false" for the changes, the reasons on stderr. */
export function main(
  args: readonly string[] = process.argv.slice(2),
  git: (args: string[]) => string = runGit,
): number {
  const [from, to = 'HEAD'] = args;
  if (!from) {
    console.error('Usage: mutation-changes.ts <from> [<to>]');
    return 1;
  }
  const { mutate } = JSON.parse(readFileSync(CONFIG, 'utf8')) as {
    mutate: string[];
  };
  const found = reasons(from, to, mutate, git);
  for (const r of found) console.error(`Mutation jobs run: ${r}`);
  if (!found.length)
    console.error(
      'No mutated file, test file, mutation configuration or test tool chain changed: the mutation jobs are skipped.',
    );
  console.log(found.length > 0 ? 'true' : 'false');
  return 0;
}

if (import.meta.main) runCli(() => main());
