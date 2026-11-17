// The size ratchet of src/client/main.ts (#242, owner, 2026-11-16): the
// allowed line count is stored in size-ratchet.json and only goes down.
// The check fails above the limit, and below it too, so whoever shrinks
// main.ts lowers the limit in the same change and the freed lines never
// come back. Lines are counted as `wc -l` counts them; `format:check`
// keeps the file in Prettier's form.
//
//   node scripts/size-ratchet.ts   (pnpm lint:size, part of pnpm check)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from './cli.ts';

export const LIMIT_FILE = 'size-ratchet.json';

export interface Limit {
  file: string;
  lines: number;
}

/** Physical lines as `wc -l` counts them: the newline characters. */
export function countLines(text: string): number {
  return text.split('\n').length - 1;
}

/** The stored limit; throws with the reason when it is malformed. */
export function parseLimit(text: string): Limit {
  const limit = JSON.parse(text) as Partial<Limit>;
  if (typeof limit.file !== 'string' || limit.file === '')
    throw new Error(`${LIMIT_FILE}: "file" must name the limited file`);
  if (!Number.isInteger(limit.lines) || limit.lines! < 0)
    throw new Error(`${LIMIT_FILE}: "lines" must be a whole number`);
  return { file: limit.file, lines: limit.lines! };
}

/** Undefined when the file has exactly its limit; else what to do. */
export function verdict(limit: Limit, lines: number): string | undefined {
  const status = `${limit.file} has ${lines} lines, the limit in ${LIMIT_FILE} is ${limit.lines}.`;
  if (lines > limit.lines)
    return `${status} It must not grow: move the code into a module or component (#118).`;
  if (lines < limit.lines)
    return `${status} Lower the limit in ${LIMIT_FILE} to ${lines} in the same change; the freed lines never come back.`;
  return undefined;
}

/** Reads the limit and its file below root; the error, or undefined. */
export function check(root: string): {
  error?: string;
  limit: Limit;
  lines: number;
} {
  const read = (file: string): string => {
    try {
      return readFileSync(path.join(root, file), 'utf8');
    } catch {
      throw new Error(`${file} is missing.`);
    }
  };
  const limit = parseLimit(read(LIMIT_FILE));
  const lines = countLines(read(limit.file));
  return { error: verdict(limit, lines), limit, lines };
}

function main(): number {
  const { error, limit, lines } = check(process.cwd());
  if (error) {
    console.error(error);
    return 1;
  }
  console.log(`${limit.file}: ${lines} lines, at its limit.`);
  return 0;
}

if (import.meta.main) runCli(main);
