// The migrations of a git ref, in each layout they have had (#213):
//   - files (owner, 2026-11-16): src/server/db/migrations/legacy/<id>.ts and
//     src/server/db/migrations/<issue>/migrations.ts, read with the loader of
//     the server from a copy of the folder;
//   - MIGRATIONS as { id, sql } records in src/server/db/schema.ts;
//   - MIGRATIONS as SQL strings in src/server/db/schema.ts (26.11.22 and
//     older).
// Used by .github/scripts/migrations-gate.mjs and scripts/new-migration.ts.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadMigrations } from '../src/server/db/migration-files.ts';
import type { ReleasedMigration } from '../src/server/db/migration-history.ts';

export const FOLDER = 'src/server/db/migrations';
const SCHEMA = 'src/server/db/schema.ts';

const git = (args: string[], cwd = process.cwd()): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

/** Whether `ref` names a commit in this repository. */
export function refExists(ref: string): boolean {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** The newest commit both refs contain. */
export const mergeBase = (a: string, b: string): string =>
  git(['merge-base', a, b]).trim();

/**
 * The newest CalVer release tag (`26.11.22`), sorted as versions, of all
 * refs as in ci.yml, or of those merged into `merged`; undefined without one.
 */
export function newestReleaseTag(
  merged?: string,
  cwd = process.cwd(),
): string | undefined {
  const args = ['tag', '--list', '[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname'];
  if (merged) args.push('--merged', merged);
  return git(args, cwd).split('\n')[0] || undefined;
}

const isReleased = (m: unknown): boolean => {
  if (typeof m === 'string') return true;
  const record = m as { id?: unknown; sql?: unknown } | null;
  return typeof record?.id === 'string' && typeof record.sql === 'string';
};

async function fromFiles(
  ref: string,
  files: string[],
  dir: string,
  cwd: string,
): Promise<ReleasedMigration[]> {
  for (const file of files) {
    const target = path.join(dir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, git(['show', `${ref}:${FOLDER}/${file}`], cwd));
  }
  return loadMigrations(dir);
}

async function fromSchema(
  ref: string,
  dir: string,
  cwd: string,
): Promise<ReleasedMigration[]> {
  const file = path.join(dir, 'schema.ts');
  writeFileSync(file, git(['show', `${ref}:${SCHEMA}`], cwd));
  const { MIGRATIONS } = (await import(pathToFileURL(file).href)) as {
    MIGRATIONS?: unknown;
  };
  if (!Array.isArray(MIGRATIONS) || !MIGRATIONS.every(isReleased))
    throw new Error(
      `${SCHEMA} at ${ref} does not export MIGRATIONS as a list of migrations.`,
    );
  return MIGRATIONS as ReleasedMigration[];
}

/** The migrations of `ref`, in the order of its list. */
export async function migrationsAt(
  ref: string,
  cwd = process.cwd(),
): Promise<ReleasedMigration[]> {
  const files = git(['ls-tree', '-r', '--name-only', ref, '--', FOLDER], cwd)
    .split('\n')
    .filter(Boolean)
    .map((f) => f.slice(FOLDER.length + 1));
  const dir = mkdtempSync(path.join(tmpdir(), 'nova-migrations-'));
  try {
    return files.length > 0
      ? await fromFiles(ref, files, dir, cwd)
      : await fromSchema(ref, dir, cwd);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
