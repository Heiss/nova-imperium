// Starts a server for the E2E suite on an empty data folder; with
// E2E_MAILBOX (e2e/env.ts) also the mail sink its SMTP settings point to.
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { openDatabase } from '../src/server/db/database.ts';
import { Store } from '../src/server/db/store.ts';
import { loadConfig } from '../src/server/config.ts';
import { databaseFile } from '../src/server/server.ts';
import { E2E_DATA, E2E_LEDGER } from './env.ts';
import { startMailSink } from './mail.ts';

rmSync(process.env.NOVA_DATA_DIR ?? E2E_DATA, { recursive: true, force: true });
rmSync(E2E_LEDGER, { force: true });
// The size of the universe, in the new database before the server opens it.
const size = process.env.E2E_UNIVERSE_JSON;
if (size) {
  const loaded = loadConfig(process.env, (f) => readFileSync(f, 'utf8'));
  if ('errors' in loaded) throw new Error(loaded.errors.join('\n'));
  mkdirSync(loaded.config.dataDir, { recursive: true });
  const store = new Store(openDatabase(databaseFile(loaded.config)));
  store.saveUniverse({ ...store.universe(), ...JSON.parse(size) });
  store.db.close();
}
const mailbox = process.env.E2E_MAILBOX;
if (mailbox) {
  rmSync(mailbox, { force: true });
  await startMailSink(Number(process.env.SMTP_PORT), mailbox);
}
await import('../src/server/main.ts');
