// The size ratchet of src/client/main.ts (#242, owner, 2026-11-16; #317 part
// 4, 2026-11-19): the file must not have more lines than it has on the base,
// the branch it goes into. There is no stored limit to edit: main.ts is the
// limit. Whoever shrinks it lowers the limit for everyone once the change is
// on main, and the freed lines never come back, because the next change is
// measured against the smaller file. Two branches that shrink main.ts, or
// that leave it alone, no longer conflict in a file for the number. Lines are
// counted as `wc -l` counts them.
//
// The base is the commit the change is measured against:
//   node scripts/size-ratchet.ts <base>   the commit or branch <base>; the CI
//        passes the base of the pull request (the first parent of the merge
//        commit it tests) or, for a push, the commit before it
//   node scripts/size-ratchet.ts          the merge base with origin/main
//        (pnpm lint:size, part of pnpm check); skipped when origin/main is not
//        fetched
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from './cli.ts';

/** The limited file. */
export const LIMITED_FILE = 'src/client/main.ts';

/** The branch a local check compares with. */
export const MAIN = 'origin/main';

/** Physical lines as `wc -l` counts them: the newline characters. */
export function countLines(text: string): number {
  return text.split('\n').length - 1;
}

/** Undefined while the file has no more lines than on the base; else what to do. */
export function verdict(
  file: string,
  lines: number,
  base: number,
): string | undefined {
  if (lines <= base) return undefined;
  return `${file} has ${lines} lines, ${lines - base} more than on its base (${base}). It must not grow: move the code into a module or component (#118).`;
}

function git(root: string, args: string[]): { status: number; out: string } {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { status: result.status ?? 1, out: result.stdout };
}

/** The commit the check measures against, or undefined when there is none. */
export function baseOf(
  root: string,
  arg: string | undefined,
  ci: boolean,
): string | undefined {
  if (arg !== undefined) {
    // The all-zero commit of a push that creates a branch: nothing before it.
    if (/^0+$/.test(arg)) return undefined;
    if (
      git(root, ['rev-parse', '--verify', '--quiet', `${arg}^{commit}`]).status
    )
      throw new Error(`The base ${arg} is missing; fetch it before the check.`);
    return arg;
  }
  if (ci)
    throw new Error('The CI passes the base commit: size-ratchet.ts <base>.');
  const found = git(root, ['merge-base', 'HEAD', MAIN]);
  return found.status === 0 ? found.out.trim() : undefined;
}

/**
 * The lines of the limited file on the base, or undefined while the file was
 * not there (a change that adds it has no base to grow from).
 */
export function baseLines(root: string, base: string): number | undefined {
  const shown = git(root, ['cat-file', 'blob', `${base}:${LIMITED_FILE}`]);
  return shown.status === 0 ? countLines(shown.out) : undefined;
}

/** The check of the repository at root: its exit code and its message. */
export function run(
  root: string,
  ci: boolean,
  arg?: string,
): { code: number; text: string } {
  let text: string;
  try {
    text = readFileSync(path.join(root, LIMITED_FILE), 'utf8');
  } catch {
    throw new Error(`${LIMITED_FILE} is missing.`);
  }
  const lines = countLines(text);
  const base = baseOf(root, arg, ci);
  if (base === undefined)
    return {
      code: 0,
      text: `${LIMITED_FILE}: ${lines} lines, no base to compare with (skipped).`,
    };
  const before = baseLines(root, base);
  if (before === undefined)
    return {
      code: 0,
      text: `${LIMITED_FILE}: ${lines} lines, not on the base yet.`,
    };
  const error = verdict(LIMITED_FILE, lines, before);
  if (error) return { code: 1, text: error };
  return {
    code: 0,
    text: `${LIMITED_FILE}: ${lines} lines, ${before} on the base.`,
  };
}

function main(): number {
  const { code, text } = run(
    process.cwd(),
    process.env.CI === 'true',
    process.argv[2],
  );
  (code ? console.error : console.log)(text);
  return code;
}

if (import.meta.main) runCli(main);
