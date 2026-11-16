// Prints the ID for a new migration and, with --create, writes the file
// skeleton src/server/db/migrations/<issue>/migrations.ts and the skeleton
// of its upgrade test src/server/db/upgrades/<id>.test.ts (owner,
// 2026-11-16, #213, „Upgrade-Test Pflicht“):
//   node scripts/new-migration.ts <issue> <short-name> [--create]
// The ID is the current UTC minute and the short name, one minute later
// while it is taken. It must be valid and newer than the newest migration
// of the last release tag (of all refs, as in ci.yml); the script refuses
// otherwise.
import { mkdirSync, writeFileSync } from 'node:fs';
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
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
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

/**
 * The upgrade test of a new migration. It fails until it is filled in: an
 * empty skeleton must not pass (no test is skipped or left empty to make the
 * CI green).
 */
export const upgradeSkeleton = (issue: string, id: string): string =>
  `// Upgrade test of migration ${id} (#${issue}): the migration runs on
// data of the version before it and keeps or changes them as intended.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import migrations from '../migrations/${issue}/migrations.ts';

const ID = '${id}';

describe(\`upgrade to migration \${ID}\`, () => {
  it('keeps the data of the version before', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const through = migrationsThrough(ID);
    const db = databaseAt(through.length - 1);
    // TODO: write data of the version before (db.exec(\`INSERT ...\`)).
    expect(migrate(db, through)).toBe(1);
    // TODO: check the data after the migration, then remove this line.
    expect.fail(\`TODO: fill in the upgrade test of \${ID}\`);
  });
});
`;

const UPGRADES = 'src/server/db/upgrades';

/**
 * Writes `text` to a new file `file`; false when the file exists already.
 * The flag `wx` checks and creates in one step, so nothing else can create
 * the file in between (CodeQL: file system race condition).
 */
function writeNew(file: string, text: string): boolean {
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    writeFileSync(file, text, { flag: 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

/**
 * Writes the upgrade test of `id` and, for the first migration of the
 * issue, its migration file; never overwrites a file. Returns the files it
 * wrote; `added` tells whether the migration file is new (else the
 * migration still has to go into its list).
 */
export function create(
  root: string,
  issue: string,
  id: string,
): { files: string[]; added: boolean } {
  const file = path.join(root, FOLDER, issue, 'migrations.ts');
  const test = path.join(root, UPGRADES, `${id}.test.ts`);
  if (!writeNew(test, upgradeSkeleton(issue, id)))
    throw new Error(`${test} exists already.`);
  const added = writeNew(file, skeleton(issue, id));
  return { files: added ? [file, test] : [test], added };
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
  if (!args.includes('--create')) return;
  const { files, added } = create(process.cwd(), issue, id);
  for (const file of files) console.log(`created ${file}`);
  if (!added)
    console.log(
      `add { id: '${id}', sql: ... } to the list of ${path.join(FOLDER, issue, 'migrations.ts')}`,
    );
}

if (import.meta.main)
  await main(process.argv.slice(2)).catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
