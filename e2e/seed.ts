// Changes the database of the running E2E server directly, for situations the
// UI would need hours to reach (ships in the hangar). Usage:
//   node e2e/seed.ts '<json>'   with { name, res?, b?, ships?, def?, temp?, pct?, research?,
//   diameter?, unlimited? (the fields of the home planet, #51),
//   clearQueue? (a finished build), colony? ({ g?, s?, p?, name?, b?, res? }: an own planet,
//   by default on slot 15 of the home system), landColonyFleet?, landFleet? (a mission:
//   its outbound fleets arrive now), returnFleet? (the returning fleets come home now),
//   finishUnits? (the shipyard has built the first n units of its stored queue now),
//   settledAgo? (ms: the home planet was last brought forward that long ago, so the
//   server adds the production of that time), serverError? (a message: an unexpected
//   server error of this player in the error log, issue #126), debris? ({ m, c }: a
//   Trümmerfeld at the position of the home planet, issue #45) }
import { openDatabase } from '../src/server/db/database.ts';
import { Store } from '../src/server/db/store.ts';
import { recordServerError } from '../src/server/error-log.ts';
import { createCtx } from '../src/server/game/context.ts';
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
    def: {},
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

store.tx(() => {
  if (d.landColonyFleet) landFleet(u.id, 'colonize');
  if (d.landFleet) landFleet(u.id, d.landFleet);
  if (d.returnFleet) returnFleet(u.id);
  if (d.research) store.saveUser({ ...u, research: d.research });
  const p = store.planetOfUser(u.id)!;
  updateHome(p);
  if (d.colony) addColony(p);
  if (d.debris) store.repos.debris.add(p, d.debris);
  if (d.serverError)
    recordServerError(createCtx(store), {
      action: 'POST /api/action',
      error: new Error(d.serverError),
      player: u.id,
    });
});
store.db.close();
