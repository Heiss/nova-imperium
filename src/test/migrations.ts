// Property-based upgrade tests of the migrations: a generator of valid data
// for any schema version, derived from the schema itself (column types,
// NOT NULL, foreign keys and the CHECK forms `x IN (...)` and `x = n`). Rows
// that SQLite rejects (UNIQUE, NOCASE, partial indexes, other CHECKs) are
// skipped, so every generated database is one the server could have written.
import Database, { type Statement } from 'better-sqlite3';
import fc from 'fast-check';
import { migrate, type Db } from '../server/db/database.ts';
import { MIGRATIONS } from '../server/db/schema.ts';

type Value = string | number | Uint8Array | null;
type Ref = { table: string; column: string };
export type Column = {
  name: string;
  type: string;
  notNull: boolean;
  allowed?: readonly Value[];
  ref?: Ref;
};
export type Table = { name: string; columns: Column[] };
/** Per table, the generated rows; a foreign key holds an index into the parent rows. */
export type Plan = Record<string, Record<string, Value>[]>;

/** An empty database with foreign keys on, at schema version `version`. */
export function databaseAt(
  version: number,
  migrations: readonly string[] = MIGRATIONS,
): Db {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db, migrations.slice(0, version));
  return db;
}

const literal = (s: string): Value => {
  const t = s.trim();
  return t.startsWith("'") ? t.slice(1, -1).replaceAll("''", "'") : Number(t);
};

/** Allowed values from `CHECK (col IN (...))` and `CHECK (col = n)`. */
function allowedValues(sql: string): Map<string, Value[]> {
  const allowed = new Map<string, Value[]>();
  for (const m of sql.matchAll(/CHECK \((\w+) IN \(([^)]*)\)\)/g))
    allowed.set(m[1]!, m[2]!.split(',').map(literal));
  for (const m of sql.matchAll(/CHECK \((\w+) = (-?\d+)\)/g))
    allowed.set(m[1]!, [Number(m[2])]);
  return allowed;
}

type ColumnInfo = { name: string; type: string; notnull: number; pk: number };
type ForeignKey = { table: string; from: string; to: string };

function describeTable(db: Db, name: string, sql: string): Table {
  const info = db.pragma(`table_info("${name}")`) as ColumnInfo[];
  const keys = db.pragma(`foreign_key_list("${name}")`) as ForeignKey[];
  const allowed = allowedValues(sql);
  const columns = info.map((c): Column => {
    const fk = keys.find((k) => k.from === c.name);
    return {
      name: c.name,
      type: c.type.toUpperCase(),
      notNull: c.notnull === 1 || c.pk === 1,
      allowed: allowed.get(c.name),
      ref: fk && { table: fk.table, column: fk.to },
    };
  });
  return { name, columns };
}

/** Parents before children, so foreign keys can point to inserted rows. */
function byDependencies(tables: Table[]): Table[] {
  const done = new Set<string>();
  const ordered: Table[] = [];
  const visit = (t: Table): void => {
    if (done.has(t.name)) return;
    done.add(t.name);
    for (const c of t.columns) {
      const parent = c.ref && tables.find((p) => p.name === c.ref!.table);
      if (parent) visit(parent);
    }
    ordered.push(t);
  };
  tables.forEach(visit);
  return ordered;
}

export function describeSchema(db: Db): Table[] {
  const rows = db
    .prepare(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all() as { name: string; sql: string }[];
  return byDependencies(rows.map((r) => describeTable(db, r.name, r.sql)));
}

// Values chosen to collide (NOCASE, empty, prefixes) and to stress the data.
const TEXTS = ['', 'a', 'A', 'Anna', 'anna', 'p1_1_5', 'x:y', "o'k", 'Ä', '💫'];
const INTEGERS = [0, 1, -1, 2, 2 ** 31, -(2 ** 31), Number.MAX_SAFE_INTEGER];

function valueOf(type: string): fc.Arbitrary<Value> {
  switch (type) {
    case 'INTEGER':
      return fc.oneof(fc.constantFrom(...INTEGERS), fc.integer());
    case 'REAL':
      return fc.oneof(
        fc.constantFrom(0, -0, 0.5, 1e300),
        fc.double({ noNaN: true }),
      );
    case 'BLOB':
      return fc.uint8Array({ maxLength: 8 }).map((b) => Buffer.from(b));
    default:
      return fc.oneof(fc.constantFrom(...TEXTS), fc.string({ maxLength: 12 }));
  }
}

function columnValue(c: Column): fc.Arbitrary<Value> {
  let arb: fc.Arbitrary<Value>;
  if (c.ref) arb = fc.nat({ max: 7 });
  else if (c.allowed) arb = fc.constantFrom(...c.allowed);
  else arb = valueOf(c.type);
  return c.notNull ? arb : fc.option(arb, { nil: null });
}

/** Up to `maxRows` rows per table for the given schema. */
export function planOf(tables: Table[], maxRows = 6): fc.Arbitrary<Plan> {
  const perTable: Record<string, fc.Arbitrary<Record<string, Value>[]>> = {};
  for (const t of tables) {
    const row = fc.record(
      Object.fromEntries(t.columns.map((c) => [c.name, columnValue(c)])),
    );
    perTable[t.name] = fc.array(row, { maxLength: maxRows });
  }
  return fc.record(perTable);
}

function isConstraintError(error: unknown): boolean {
  return (
    error instanceof Database.SqliteError &&
    error.code.startsWith('SQLITE_CONSTRAINT')
  );
}

/** Replaces foreign key indexes by the key of an inserted parent row. */
function resolve(
  db: Db,
  t: Table,
  row: Record<string, Value>,
): Record<string, Value> | null {
  const out = { ...row };
  for (const c of t.columns) {
    if (!c.ref || out[c.name] === null) continue;
    const keys = db
      .prepare(`SELECT "${c.ref.column}" FROM "${c.ref.table}" ORDER BY rowid`)
      .pluck()
      .all() as Value[];
    if (keys.length === 0) {
      if (c.notNull) return null;
      out[c.name] = null;
    } else out[c.name] = keys[(out[c.name] as number) % keys.length]!;
  }
  return out;
}

function tryInsert(insert: Statement, values: Record<string, Value>): void {
  try {
    insert.run(values);
  } catch (error) {
    if (!isConstraintError(error)) throw error;
  }
}

/** Inserts the plan; rows that SQLite rejects are skipped. */
export function populate(db: Db, tables: Table[], plan: Plan): void {
  for (const t of tables) {
    const names = t.columns.map((c) => `"${c.name}"`).join(', ');
    const params = t.columns.map((c) => `@${c.name}`).join(', ');
    const insert = db.prepare(
      `INSERT INTO "${t.name}" (${names}) VALUES (${params})`,
    );
    for (const row of plan[t.name] ?? []) {
      const values = resolve(db, t, row);
      if (values) tryInsert(insert, values);
    }
  }
}

/** Schema entries and the content of every table, for comparisons. */
export function snapshot(db: Db): {
  schema: Map<string, string>;
  data: Map<string, string>;
} {
  const entries = db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL`)
    .all() as { name: string; sql: string }[];
  const schema = new Map(entries.map((e) => [e.name, e.sql]));
  const data = new Map<string, string>();
  for (const t of describeSchema(db)) {
    const rows = db.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all();
    data.set(t.name, JSON.stringify(rows));
  }
  return { schema, data };
}

/** True when the migration changed or removed anything that existed before. */
export function changesExisting(
  before: ReturnType<typeof snapshot>,
  after: ReturnType<typeof snapshot>,
): boolean {
  for (const [name, sql] of before.schema)
    if (after.schema.get(name) !== sql) return true;
  for (const [name, rows] of before.data)
    if (after.data.get(name) !== rows) return true;
  return false;
}

/** Migration n on the generated data, with the state around it. */
export function upgrade(
  n: number,
  plan: Plan,
  migrations: readonly string[] = MIGRATIONS,
) {
  const db = databaseAt(n - 1, migrations);
  try {
    populate(db, describeSchema(db), plan);
    const before = snapshot(db);
    migrate(db, migrations.slice(0, n));
    return {
      before,
      after: snapshot(db),
      integrity: db.pragma('integrity_check', { simple: true }),
      foreignKeys: db.pragma('foreign_key_check'),
    };
  } finally {
    db.close();
  }
}

/** Generated data for the schema before migration n. */
export function plansBefore(
  n: number,
  migrations: readonly string[] = MIGRATIONS,
): fc.Arbitrary<Plan> {
  const db = databaseAt(n - 1, migrations);
  const tables = describeSchema(db);
  db.close();
  return planOf(tables);
}
