// Changes the database of the running E2E server directly, for situations the
// UI would need hours to reach (ships in the hangar). Usage:
//   node e2e/seed.ts '<json>'   with { name, res?, b?, ships?, def?, research? }
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
store.tx(() => {
  if (d.research) store.saveUser({ ...u, research: d.research });
  const p = store.planetOfUser(u.id)!;
  store.savePlanet({
    ...p,
    res: d.res ?? p.res,
    b: d.b ?? p.b,
    ships: d.ships ?? p.ships,
    def: d.def ?? p.def,
  });
});
store.db.close();
