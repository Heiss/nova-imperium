// Test setup for the server: a real SQLite database in memory, a clock the
// test moves, a seeded random generator and readable ids.
import Database from 'better-sqlite3';
import { seeded } from '../test/fixtures.ts';
import { DEFAULT_EXPLAIN } from '../core/explain.ts';
import { DEFAULT_LEVEL_MODE } from '../core/level-overview.ts';
import type { Planet } from '../core/types.ts';
import { hashPassword } from './auth.ts';
import type { Config } from './config.ts';
import { openDatabase, type Db } from './db/database.ts';
import type { User } from './db/repos/players.ts';
import { Store } from './db/store.ts';
import { createCtx, type Ctx } from './game/context.ts';

export interface TestCtx extends Ctx {
  clock: { t: number };
  /** The facade over the same repositories, for the store tests (#117). */
  store: Store;
  /** The statement cache of the database: on for a database of `testCtx`. */
  statements: StatementCache;
}

let template: Buffer | undefined;

/**
 * A new migrated in-memory database. The migrations run once per test file;
 * every further database is a copy of that result with the pragmas of
 * `openDatabase` (about 1 ms instead of about 40 ms).
 */
function memoryDatabase(): Db {
  template ??= openDatabase(':memory:').serialize();
  const db = new Database(template);
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

/**
 * Keeps the prepared statements of a database by their SQL text for as long
 * as it is `on`: the code under test prepares its statements per call, and
 * `better-sqlite3` would compile the same text again and again (about half of
 * the time of a route test). A statement is shared by its text, so the calls
 * that change one (`pluck`, `raw`, `expand`, `safeIntegers`, `bind`) answer a
 * statement of their own. A test that measures what the production code
 * costs turns it `off` while it measures.
 */
interface StatementCache {
  on(): void;
  off(): void;
}

const CHANGING = ['pluck', 'raw', 'expand', 'safeIntegers', 'bind'] as const;

function statementCache(db: Db): StatementCache {
  const kept = new Map<string, unknown>();
  const real = Object.getPrototypeOf(db).prepare as (sql: string) => unknown;
  const set = (prepare: unknown): void => {
    (db as { prepare: unknown }).prepare = prepare;
  };
  const cached = (sql: string): unknown => {
    // A closed database answers with its own error.
    if (!db.open) return real.call(db, sql);
    let statement = kept.get(sql);
    if (!statement) {
      const made = real.call(db, sql) as Record<string, unknown>;
      for (const method of CHANGING)
        made[method] = (...args: unknown[]) =>
          (
            (real.call(db, sql) as Record<string, unknown>)[method] as (
              ...a: unknown[]
            ) => unknown
          )(...args);
      kept.set(sql, (statement = made));
    }
    return statement;
  };
  return { on: () => set(cached), off: () => set(real) };
}

/**
 * One migrated in-memory database for a property test that builds a world per
 * generated case. `open()` hands out the database as it was migrated, with
 * the statement cache on, and `rewind()` takes every change of the case back
 * (a savepoint, so the database, its statements and its pragmas stay): a case
 * then costs its own rows, not a new database. A case that ends in an error
 * is rewound by the next `open()`.
 */
export interface CaseDb {
  open(): Db;
  rewind(): void;
}

export function caseDatabase(): CaseDb {
  let db: Db | undefined;
  let open = false;
  const rewind = (): void => {
    if (!db || !open) return;
    db.exec('ROLLBACK TO SAVEPOINT test_case; RELEASE SAVEPOINT test_case');
    open = false;
  };
  return {
    open() {
      if (!db) {
        db = memoryDatabase();
        statementCache(db).on();
      }
      rewind();
      db.exec('SAVEPOINT test_case');
      open = true;
      return db;
    },
    rewind,
  };
}

export function testCtx(start = 1_000_000, seed = 42, db?: Db): TestCtx {
  const clock = { t: start };
  let n = 0;
  const own = db === undefined;
  db ??= memoryDatabase();
  const statements = statementCache(db);
  if (own) statements.on();
  const store = new Store(db);
  return {
    ...createCtx(store, {
      now: () => clock.t,
      rng: seeded(seed),
      id: () => `id${++n}`,
    }),
    store,
    clock,
    statements,
  };
}

export const testConfig = (over: Partial<Config> = {}): Config => ({
  host: '127.0.0.1',
  port: 0,
  dataDir: './data',
  publicUrl: 'http://localhost:8080',
  secureCookies: false,
  trustProxy: false,
  sessionDays: 30,
  passwordMinLength: 15,
  inviteDays: 7,
  rateLimitAttempts: 20,
  rateLimitMinutes: 10,
  emailLoginCodes: false,
  webPush: false,
  smtp: null,
  ...over,
});

const testPassword = hashPassword('secret1', 'salt');

export function addUser(
  ctx: Ctx,
  name: string,
  over: Partial<User> = {},
): User {
  const u: User = {
    id: `u_${name}`,
    name,
    email: `${name.toLowerCase()}@example.org`,
    salt: 'salt',
    pw: testPassword,
    admin: false,
    probes: 1,
    explain: DEFAULT_EXPLAIN,
    levelTable: DEFAULT_LEVEL_MODE,
    readAt: 0,
    created: ctx.now(),
    research: {},
    rq: null,
    mainPlanet: null,
    mainSwitched: null,
    vacation: null,
    ...over,
  };
  ctx.players.save(u);
  return u;
}

export function addPlanet(
  ctx: Ctx,
  owner: string,
  over: Partial<Planet> = {},
): Planet {
  const g = over.g ?? 1;
  const s = over.s ?? 1;
  const p = over.p ?? 5;
  const planet: Planet = {
    id: `p${g}_${s}_${p}`,
    kind: 'planet',
    owner,
    name: `Planet ${owner}`,
    g,
    s,
    p,
    temp: 50,
    diameter: 12800,
    unlimited: false,
    res: { m: 100000, c: 100000, d: 100000 },
    b: {},
    ships: {},
    def: {},
    bq: null,
    sq: [],
    sqT: null,
    pct: {},
    t: ctx.now(),
    created: ctx.now(),
    ...over,
  };
  ctx.planets.save(planet);
  return planet;
}

/** A push device of a player (#192), written without the browser's keys check. */
export function subscribePush(ctx: Ctx, uid: string, device = 1): string {
  const endpoint = `https://fcm.googleapis.com/fcm/send/${uid}-${device}`;
  ctx.db
    .prepare('INSERT INTO push_subscriptions VALUES (?, ?, ?, ?)')
    .run(endpoint, uid, 'p256dh', 'auth');
  return endpoint;
}

/** The queued pushes: player, view and kind, in the order they were queued. */
export function queuedPushes(
  ctx: Ctx,
): { user: string; kind: string; topic: string | null }[] {
  return ctx.db
    .prepare(
      `SELECT s.user_id AS user, j.kind, j.topic FROM push_jobs j
       JOIN push_subscriptions s USING (endpoint) ORDER BY j.rowid`,
    )
    .all() as { user: string; kind: string; topic: string | null }[];
}
