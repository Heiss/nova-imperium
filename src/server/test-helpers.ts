// Test setup for the server: a real SQLite database in memory, a clock the
// test moves, a seeded random generator and readable ids.
import { seeded } from '../test/fixtures.ts';
import { DEFAULT_EXPLAIN } from '../core/explain.ts';
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
}

export function testCtx(
  start = 1_000_000,
  seed = 42,
  db: Db = openDatabase(':memory:'),
): TestCtx {
  const clock = { t: start };
  let n = 0;
  const store = new Store(db);
  return {
    ...createCtx(store, {
      now: () => clock.t,
      rng: seeded(seed),
      id: () => `id${++n}`,
    }),
    store,
    clock,
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
    readAt: 0,
    created: ctx.now(),
    research: {},
    rq: null,
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
