// The planets that lie in an area of the E2E universe (e2e/ledger.ts), read
// from the database of the running E2E server, as e2e/seed.ts opens it.
// Usage:
//   node e2e/area-planets.ts '{"g":2,"s":61}'   prints a JSON list of "g:s:p"
// A new round puts the home planet of every player on a random position of
// any galaxy (src/server/game/admin.ts), also into an area no test has been
// handed yet; `ownArea` of e2e/own-data.ts hands out only an empty one.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../src/server/db/database.ts';
import { Store } from '../src/server/db/store.ts';
import { loadConfig } from '../src/server/config.ts';
import { inArea } from './ledger.ts';

const config = loadConfig(process.env, (f) => readFileSync(f, 'utf8'));
if ('errors' in config) throw new Error(config.errors.join('\n'));
// The file of `databaseFile()` in src/server/server.ts, as in e2e/seed.ts.
const DB_FILE = 'nova.sqlite';
const store = new Store(
  openDatabase(path.join(config.config.dataDir, DB_FILE)),
);
const area = JSON.parse(process.argv[2] ?? '{}') as { g: number; s: number };
const found = store.repos.planets
  .all()
  .filter((p) => inArea({ n: 0, ...area }, p))
  .map((p) => `${p.g}:${p.s}:${p.p}`);
process.stdout.write(JSON.stringify(found));
