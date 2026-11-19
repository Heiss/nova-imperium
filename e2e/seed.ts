// Changes the database of the running E2E server directly, for situations the
// UI would need hours to reach (ships in the hangar). Usage:
//   node e2e/seed.ts '<json>'   with { name, … }
// The frame only reads the call and runs the parts of `e2e/seed/` in one
// transaction. Every file there handles its own fields and lists them: a
// feature that needs a new field adds a file (`order` says when it runs, see
// `lib/types.ts`), and a field no part lists is refused.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../src/server/db/database.ts';
import { Store } from '../src/server/db/store.ts';
import { databaseFile } from '../src/server/server.ts';
import { loadConfig } from '../src/server/config.ts';
import {
  HOME_SAVED_AT,
  type SeedData,
  type SeedPart,
} from './seed/lib/types.ts';

const dir = path.join(import.meta.dirname, 'seed');
const parts: SeedPart[] = [];
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .sort()) {
  const loaded = (await import(pathToFileURL(path.join(dir, file)).href)) as {
    part?: SeedPart;
  };
  if (!loaded.part) throw new Error(`e2e/seed/${file} exports no \`part\``);
  parts.push(loaded.part);
}
parts.sort((a, b) => a.order - b.order);

const config = loadConfig(process.env, (f) => readFileSync(f, 'utf8'));
if ('errors' in config) throw new Error(config.errors.join('\n'));
const store = new Store(openDatabase(databaseFile(config.config)));
const d: SeedData = JSON.parse(process.argv[2] ?? '{}');

const known = new Set(['name', ...parts.flatMap((p) => p.fields)]);
for (const field of Object.keys(d))
  if (!known.has(field))
    throw new Error(
      `no part of e2e/seed/ handles the field "${field}" (known: ${[...known].sort().join(', ')})`,
    );

const user = store.userByName(d.name);
if (!user) throw new Error(`no player ${d.name}`);
const planet = store.planetOfUser(user.id)!;
const s = { store, d, user, planet, home: { ...planet } };

store.tx(() => {
  let saved = false;
  for (const part of parts) {
    if (!saved && part.order >= HOME_SAVED_AT) {
      store.savePlanet(s.home);
      saved = true;
    }
    part.apply(s);
  }
  if (!saved) store.savePlanet(s.home);
});
store.db.close();
