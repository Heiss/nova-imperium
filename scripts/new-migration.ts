// Prints the ID for a new migration and, with --create, writes the file
// skeleton src/server/db/migrations/<issue>/migrations.ts (owner,
// 2026-11-16, #213):
//   node scripts/new-migration.ts <issue> <short-name> [--create]
// The ID is the current UTC minute and the short name, one minute later
// while it is taken. It must be valid and newer than the newest migration
// of the last release tag (of all refs, as in ci.yml); the script refuses
// otherwise.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  idViolation,
  newestReleasedId,
} from '../src/server/db/migration-history.ts';
import { MIGRATIONS } from '../src/server/db/schema.ts';
import { FOLDER, migrationsAt, newestReleaseTag } from './migration-refs.ts';

const ISSUE = /^[1-9]\d*$/;

/** `YYYYMMDDTHHMM` of `time` in UTC. */
export const stamp = (time: Date): string =>
  time.toISOString().slice(0, 16).replaceAll(/[-:]/g, '');

/**
 * The ID for a new migration named `name` at `now`: the first free minute
 * from `now` on. Throws for an invalid name, or when the ID is not newer
 * than `newest`, the newest migration of the last release.
 */
export function nextMigrationId(
  now: Date,
  name: string,
  taken: readonly string[],
  newest: string | undefined,
): string {
  let time = now;
  let id = `${stamp(time)}-${name}`;
  const invalid = idViolation(id);
  if (invalid) throw new Error(invalid);
  while (taken.includes(id)) {
    time = new Date(time.getTime() + 60_000);
    id = `${stamp(time)}-${name}`;
  }
  if (newest !== undefined && id <= newest)
    throw new Error(
      `${id} is not newer than ${newest}, the newest migration of the last release. Check the clock: a new migration needs an ID after the last release.`,
    );
  return id;
}

/** The file of a new issue with its first migration. */
export const skeleton = (issue: string, id: string): string =>
  `// The migrations of #${issue}. The list may hold more than one; each
// migration is never changed once it is on main.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '${id}',
    sql: \`
  \`,
  },
];

export default migrations;
`;

/** Checks the issue number and writes the skeleton unless the file exists. */
export function create(root: string, issue: string, id: string): string {
  const file = path.join(root, FOLDER, issue, 'migrations.ts');
  if (existsSync(file))
    throw new Error(
      `${file} exists: add { id: '${id}', sql: ... } to its list.`,
    );
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, skeleton(issue, id));
  return file;
}

async function main(args: string[]): Promise<void> {
  const [issue, name] = args.filter((a) => a !== '--create');
  if (!issue || !ISSUE.test(issue) || !name)
    throw new Error(
      'Usage: node scripts/new-migration.ts <issue number> <short-name> [--create]',
    );
  const tag = newestReleaseTag();
  const newest = tag
    ? newestReleasedId(await migrationsAt(tag), MIGRATIONS)
    : undefined;
  const taken = MIGRATIONS.map((m) => m.id);
  const id = nextMigrationId(new Date(), name, taken, newest);
  console.log(id);
  if (args.includes('--create'))
    console.log(`created ${create(process.cwd(), issue, id)}`);
}

if (import.meta.main)
  await main(process.argv.slice(2)).catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
