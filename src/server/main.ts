// Entry point of the server process: reads the settings, starts, stops cleanly.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.ts';
import { loadNews } from './news.ts';
import { startServer } from './server.ts';

const loaded = loadConfig(process.env, (f) => readFileSync(f, 'utf8'));
if ('errors' in loaded) {
  console.error('Nova Imperium does not start, the settings are invalid:');
  for (const e of loaded.errors) console.error(`  - ${e}`);
  process.exit(1);
}
const { config } = loaded;
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const running = await startServer({
  cfg: config,
  publicDir: path.join(root, 'dist/public'),
  news: loadNews(root),
});
console.log(
  running.ctx
    ? `Nova Imperium listens on http://${config.host}:${running.port} (public address ${config.publicUrl}, ` +
        `mail ${config.smtp ? 'on' : 'off'})`
    : `Nova Imperium answers "Wartung" on port ${running.port}: the database was not migrated (reason above). ` +
        'Fix the cause and restart the container.',
);
const stop = (): void => {
  console.log('Stopping …');
  void running.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
