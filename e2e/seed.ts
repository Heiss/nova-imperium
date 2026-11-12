// Changes the database of the running E2E server directly, for situations the
// UI would need hours to reach (ships in the hangar). Usage:
//   node e2e/seed.ts '<json>'   with { name, res?, b?, ships?, def?, temp?, pct?, research?,
//   clearQueue? (a finished build), colony? ({ g?, s?, p?, name?, b?, res? }: an own planet,
//   by default on slot 15 of the home system) }
import { openDatabase } from '../src/server/db/database.ts';
import { Store } from '../src/server/db/store.ts';
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

function landColonyFleet(id: string): void {
  store.db
    .prepare(
      "UPDATE fleets SET arr = ? WHERE owner = ? AND mission = 'colonize' AND state = 'out'",
    )
    .run(Date.now(), id);
}

function updateHome(p: Planet): void {
  store.savePlanet({
    ...p,
    res: d.res ?? p.res,
    b: d.b ?? p.b,
    ships: d.ships ?? p.ships,
    def: d.def ?? p.def,
    temp: d.temp ?? p.temp,
    pct: d.pct ?? p.pct,
    bq: d.clearQueue ? null : p.bq,
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
}

store.tx(() => {
  if (d.landColonyFleet) landColonyFleet(u.id);
  if (d.research) store.saveUser({ ...u, research: d.research });
  const p = store.planetOfUser(u.id)!;
  updateHome(p);
  if (d.colony) addColony(p);
});
store.db.close();
