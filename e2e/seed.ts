// Changes the database of the running E2E server directly, for situations the
// UI would need hours to reach (ships in the hangar). Usage:
//   node e2e/seed.ts '<json>'   with { name, res?, b?, ships?, def?, temp?, pct?, research?,
//   diameter?, unlimited? (the fields of the home planet, #51),
//   clearQueue? (a finished build), colony? ({ g?, s?, p?, name?, b?, res?, def? }: an own planet,
//   by default on slot 15 of the home system), landColonyFleet?, landFleet? (a mission:
//   its outbound fleets arrive now), returnFleet? (the returning fleets come home now),
//   finishUnits? (the shipyard has built the first n units of its stored queue now),
//   settledAgo? (ms: the home planet was last brought forward that long ago, so the
//   server adds the production of that time), serverError? (a message: an unexpected
//   server error of this player in the error log, issue #126), debris? ({ m, c }: a
//   Trümmerfeld at the position of the home planet, issue #45), moon? ({ b?, res?, ships?,
//   def?, name?, diameter? }: the moon of the home planet, made or changed, issue #53),
//   gift? (minutes: a gift fleet of the „Endzeit“ to the home planet that arrives in that
//   time, issue #161), colonyMoon? (the fields of `moon`: the moon of the colony, made or
//   changed, with `colony`, issue #230), activeAgo? (ms: the account and every place of the
//   player were last active that long ago, issue #229) }
import { openDatabase } from '../src/server/db/database.ts';
import { Store } from '../src/server/db/store.ts';
import { recordServerError } from '../src/server/error-log.ts';
import { createCtx } from '../src/server/game/context.ts';
import { giftFleet } from '../src/server/game/endzeit.ts';
import { databaseFile } from '../src/server/server.ts';
import { loadConfig } from '../src/server/config.ts';
import { readFileSync } from 'node:fs';

const loaded = loadConfig(process.env, (f) => readFileSync(f, 'utf8'));
if ('errors' in loaded) throw new Error(loaded.errors.join('\n'));
const store = new Store(openDatabase(databaseFile(loaded.config)));
const d = JSON.parse(process.argv[2] ?? '{}');
const u = store.userByName(d.name);
if (!u) throw new Error(`no player ${d.name}`);
type Planet = NonNullable<ReturnType<Store['planetOfUser']>>;

/** Lets the player's outbound fleets of one mission arrive now. */
function landFleet(id: string, mission: string): void {
  store.db
    .prepare(
      "UPDATE fleets SET arr = ? WHERE owner = ? AND mission = ? AND state = 'out'",
    )
    .run(Date.now(), id, mission);
}

/** Lets the player's returning fleets come home now. */
function returnFleet(id: string): void {
  store.db
    .prepare("UPDATE fleets SET ret = ? WHERE owner = ? AND state = 'back'")
    .run(Date.now(), id);
}

/** The start of the shipyard that has finished the first `n` units of its queue now. */
function yardStart(p: Planet, n: number): number | null {
  if (p.sqT === null) return null;
  let ms = 0;
  let left = n;
  for (const q of p.sq) {
    const done = Math.min(left, q.n);
    ms += done * q.unit;
    left -= done;
  }
  return Date.now() - ms;
}

/** The queues and the last update of the home planet, moved as asked. */
function timers(p: Planet): Pick<Planet, 'bq' | 'sqT' | 't'> {
  return {
    bq: d.clearQueue ? null : p.bq,
    sqT: d.finishUnits ? yardStart(p, d.finishUnits) : p.sqT,
    t: d.settledAgo ? Date.now() - d.settledAgo : p.t,
  };
}

function updateHome(p: Planet): void {
  store.savePlanet({
    ...p,
    res: d.res ?? p.res,
    b: d.b ?? p.b,
    ships: d.ships ?? p.ships,
    def: d.def ?? p.def,
    temp: d.temp ?? p.temp,
    diameter: d.diameter ?? p.diameter,
    unlimited: d.unlimited ?? p.unlimited,
    pct: d.pct ?? p.pct,
    ...timers(p),
  });
}

/** Slot 15 of the home system by default: new players are placed on 4 to 12 only. */
function addColony(p: Planet): void {
  const c = { g: d.colony.g ?? p.g, s: d.colony.s ?? p.s, p: d.colony.p ?? 15 };
  store.savePlanet({
    ...p,
    ...c,
    id: `p${c.g}_${c.s}_${c.p}`,
    name: d.colony.name ?? 'Kolonie',
    res: d.colony.res ?? p.res,
    b: d.colony.b ?? {},
    ships: {},
    def: d.colony.def ?? {},
    bq: null,
    sq: [],
    sqT: null,
    pct: {},
    created: Date.now(),
  });
  // Two test players can share a home system, so slot 15 may hold an older
  // colony of an earlier test. savePlanet keeps `created` on a conflict, and
  // the oldest planet is the home planet: the reused slot would become it.
  store.db
    .prepare('UPDATE planets SET created = ? WHERE id = ?')
    .run(Date.now(), `p${c.g}_${c.s}_${c.p}`);
}

/** The colony of `colony`, as addColony places it. */
const colonyOf = (p: Planet): Planet =>
  store.planet(
    `p${d.colony.g ?? p.g}_${d.colony.s ?? p.s}_${d.colony.p ?? 15}`,
  )!;

/**
 * The moon of a planet (#53): made when it is not there yet, then changed.
 * Two test players can share a home system, so the slot may hold the moon
 * of an earlier test: that one is made anew for the owner of the planet,
 * without the cooldown of its Warp-Tor (#230, review of #293).
 */
function moonOf(p: Planet, over: Partial<Planet>): void {
  const id = `m${p.g}_${p.s}_${p.p}`;
  const found = store.planet(id);
  const old = found?.owner === p.owner ? found : null;
  if (found && !old)
    store.db.prepare('DELETE FROM jump_gates WHERE moon_id = ?').run(id);
  const t = Date.now();
  store.savePlanet({
    ...(old ?? {
      ...p,
      id,
      kind: 'moon',
      name: 'Mond',
      diameter: 5000,
      unlimited: false,
      res: { m: 0, c: 0, d: 0 },
      b: {},
      ships: {},
      def: {},
      bq: null,
      sq: [],
      sqT: null,
      pct: {},
      t,
      created: t,
    }),
    ...over,
  });
}

/** The colony, and its moon when asked (#230). */
function addColonyAndMoon(p: Planet): void {
  addColony(p);
  if (d.colonyMoon) moonOf(colonyOf(p), d.colonyMoon);
}

/** The last activity of the account and of every place of the player, `ms` ago (#229). */
function activeAgo(id: string, ms: number): void {
  const at = Date.now() - ms;
  store.db.prepare('UPDATE users SET active_at = ? WHERE id = ?').run(at, id);
  store.db
    .prepare('UPDATE planets SET active_at = ? WHERE owner = ?')
    .run(at, id);
}

/** A gift fleet of the „Endzeit“ alone, without the trigger for every player. */
function addGift(p: Planet, minutes: number): void {
  const now = Date.now();
  const ctx = createCtx(store);
  ctx.fleets.save(giftFleet(ctx, p, now, now + minutes * 60000));
}

/** What lies at the home planet or goes with the player: a Trümmerfeld, the moon, a gift, the activity. */
function addAround(p: Planet): void {
  if (d.debris) store.repos.debris.add(p, d.debris);
  if (d.moon) moonOf(p, d.moon);
  if (d.gift) addGift(p, d.gift);
  if (d.activeAgo !== undefined) activeAgo(u!.id, d.activeAgo);
}

store.tx(() => {
  if (d.landColonyFleet) landFleet(u.id, 'colonize');
  if (d.landFleet) landFleet(u.id, d.landFleet);
  if (d.returnFleet) returnFleet(u.id);
  if (d.research) store.saveUser({ ...u, research: d.research });
  const p = store.planetOfUser(u.id)!;
  updateHome(p);
  if (d.colony) addColonyAndMoon(p);
  addAround(p);
  if (d.serverError)
    recordServerError(createCtx(store), {
      action: 'POST /api/action',
      error: new Error(d.serverError),
      player: u.id,
    });
});
store.db.close();
