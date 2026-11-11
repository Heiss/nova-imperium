// Entry point of the operator command `nova` (see commands.ts).
import { readFileSync } from 'node:fs';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { Store } from './db/store.ts';
import { createCtx } from './game/context.ts';
import { createMailer } from './mail.ts';
import { runCommand } from './commands.ts';
import { maintenanceCommand } from './maintenance.ts';
import { databaseFile } from './server.ts';

const loaded = loadConfig(process.env, (f) => readFileSync(f, 'utf8'));
if ('errors' in loaded) {
  for (const e of loaded.errors) console.error(e);
  process.exit(1);
}
const { config } = loaded;
const args = process.argv.slice(2);
// Maintenance works without the database: it may be migrating right now.
if (args[0] === 'maintenance')
  process.exit(
    maintenanceCommand(config.dataDir, args.slice(1), (l) => console.log(l)),
  );
const db = openDatabase(databaseFile(config));
const ctx = createCtx(new Store(db));
const mailer = config.smtp ? createMailer(config.smtp) : null;
const code = await runCommand(ctx, config, mailer, args, {
  out: (l) => console.log(l),
  err: (l) => console.error(l),
});
db.close();
process.exit(code);
