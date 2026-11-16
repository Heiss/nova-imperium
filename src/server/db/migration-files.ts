// The migrations live in files, so two pull requests that each add one do
// not touch the same file (owner, 2026-11-16, #213):
//   migrations/legacy/<id>.ts      the 20 migrations from before the IDs,
//                                  exporting `id`, `number` and `sql`
//   migrations/<issue>/migrations.ts
//                                  the migrations of one issue, a default
//                                  export `[{ id, sql }, ...]`
// The server reads the folder when it starts (no index file), sorts the
// migrations by ID and refuses a stray file and an ID that is used twice.
import { readdirSync, type Dirent } from 'node:fs';
import path from 'node:path';
import { orderViolation } from './migration-history.ts';

/**
 * One migration: its fixed ID and its SQL, which never change once on main.
 * `number` is the place of the 20 migrations from before the IDs; a
 * database at user_version N without schema_migrations has run numbers 1
 * to N (D2). Later migrations have none.
 */
export type Migration = {
  readonly id: string;
  readonly sql: string;
  readonly number?: number;
};

type Found = { migration: Migration; file: string };

const ISSUE = /^[1-9]\d*$/;

const stray = (file: string): Error =>
  new Error(
    `Stray file ${file} in the migrations folder: it holds legacy/<id>.ts and <issue number>/migrations.ts only.`,
  );

// An absolute path, not a file: URL: Vitest (and so Stryker) then loads the
// file through its own module graph like any other module.
const load = async (dir: string, file: string): Promise<unknown> =>
  import(path.resolve(dir, file));

const isText = (value: unknown): value is string => typeof value === 'string';

async function legacyFile(dir: string, name: string): Promise<Found> {
  const file = `legacy/${name}`;
  if (!name.endsWith('.ts')) throw stray(file);
  const { id, number, sql } = (await load(dir, file)) as Partial<Migration>;
  if (`${id}.ts` !== name || !Number.isInteger(number) || !isText(sql))
    throw new Error(
      `${file} must export its ID (the file name), its number and its SQL.`,
    );
  return { migration: { id: id!, number, sql }, file };
}

async function issueFile(dir: string, entry: Dirent): Promise<Found[]> {
  const names = readdirSync(path.join(dir, entry.name));
  const extra = names.find((n) => n !== 'migrations.ts');
  if (extra !== undefined) throw stray(`${entry.name}/${extra}`);
  const file = `${entry.name}/migrations.ts`;
  const list = ((await load(dir, file)) as { default?: unknown }).default;
  const valid =
    Array.isArray(list) &&
    list.length > 0 &&
    list.every((m: Partial<Migration>) => isText(m?.id) && isText(m.sql));
  if (!valid)
    throw new Error(
      `${file} must export a list of migrations: export default [{ id, sql }].`,
    );
  return (list as Migration[]).map(({ id, sql }) => ({
    migration: { id, sql },
    file,
  }));
}

async function entryFiles(dir: string, entry: Dirent): Promise<Found[]> {
  if (!entry.isDirectory()) throw stray(entry.name);
  if (entry.name === 'legacy')
    return Promise.all(
      readdirSync(path.join(dir, 'legacy')).map((n) => legacyFile(dir, n)),
    );
  if (!ISSUE.test(entry.name)) throw stray(entry.name);
  return issueFile(dir, entry);
}

/** The migrations of the folder `dir`, sorted by ID. */
export async function loadMigrations(dir: string): Promise<Migration[]> {
  const entries = readdirSync(dir, { withFileTypes: true });
  const found = (
    await Promise.all(entries.map((e) => entryFiles(dir, e)))
  ).flat();
  const byId = new Map<string, Found>();
  for (const f of found) {
    const other = byId.get(f.migration.id);
    if (other)
      throw new Error(
        `Migration ${f.migration.id} is defined twice, in ${[other.file, f.file].toSorted().join(' and in ')}.`,
      );
    byId.set(f.migration.id, f);
  }
  const migrations = [...byId.keys()]
    .toSorted()
    .map((id) => byId.get(id)!.migration);
  const order = orderViolation(migrations);
  if (order) throw new Error(order);
  return migrations;
}
