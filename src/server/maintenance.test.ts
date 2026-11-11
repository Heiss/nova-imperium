import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './db/database.ts';
import { MIGRATIONS } from './db/schema.ts';
import { CSP } from './http/security.ts';
import { maintenanceCommand, MESSAGES } from './maintenance.ts';
import { migrateInWorker, startServer } from './server.ts';
import { testConfig } from './test-helpers.ts';

const PUBLIC = path.resolve(import.meta.dirname, '../test/public');
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-maint-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const cfg = () => testConfig({ dataDir: dir });
const get = (port: number, url: string) =>
  fetch(`http://127.0.0.1:${port}${url}`);

describe('maintenance during a migration', () => {
  it('answers „Wartung“ until the migration is done, then plays', async () => {
    let finish: (() => void) | null = null;
    const logs: string[] = [];
    const port = await freePort();
    const starting = startServer({
      cfg: { ...cfg(), port },
      publicDir: PUBLIC,
      dbFile: ':memory:',
      log: (m) => logs.push(m),
      migrate: () => new Promise<void>((r) => (finish = r)),
    });
    while (!finish) await new Promise((r) => setTimeout(r, 5));
    const api = await get(port, '/api/state');
    expect(api.status).toBe(503);
    expect(api.headers.get('nova-maintenance')).toBe('update');
    expect(api.headers.get('retry-after')).toBe('30');
    expect(api.headers.get('cache-control')).toBe('no-store');
    expect(api.headers.get('content-security-policy')).toBe(CSP);
    expect(await api.json()).toEqual({
      error: MESSAGES.update,
      maintenance: 'update',
    });
    const health = await get(port, '/healthz');
    expect(health.status).toBe(503);
    const page = await get(port, '/?x=1');
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await page.text()).toContain(`<p>${MESSAGES.update}</p>`);
    (finish as () => void)();
    const running = await starting;
    expect((await get(port, '/healthz')).status).toBe(200);
    expect(logs).toEqual([]);
    await running.stop();
  });

  it('stays stopped after a refused migration and never opens the database', async () => {
    const logs: string[] = [];
    const running = await startServer({
      cfg: cfg(),
      publicDir: PUBLIC,
      dbFile: path.join(dir, 'never.sqlite'),
      log: (m) => logs.push(m),
      migrate: () => Promise.reject(new Error('No good backup.')),
    });
    expect(running.ctx).toBeNull();
    expect(logs).toEqual([
      'Nova Imperium stays in maintenance: No good backup.',
    ]);
    const health = await get(running.port, '/healthz');
    expect(health.status).toBe(503);
    expect(await health.json()).toEqual({
      error: MESSAGES.stopped,
      maintenance: 'stopped',
    });
    await running.stop();
    expect(existsSync(path.join(dir, 'never.sqlite'))).toBe(false);
  });
});

describe('planned maintenance', () => {
  it('keeps players out while the operator has it on; the health check stays good', async () => {
    const running = await startServer({
      cfg: cfg(),
      publicDir: PUBLIC,
      dbFile: ':memory:',
      log: () => {},
    });
    const lines: string[] = [];
    const out = (l: string) => lines.push(l);
    expect(maintenanceCommand(dir, ['on'], out)).toBe(0);
    const api = await get(running.port, '/api/state');
    expect(api.status).toBe(503);
    expect(await api.json()).toEqual({
      error: MESSAGES.planned,
      maintenance: 'planned',
    });
    const health = await get(running.port, '/healthz');
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, maintenance: 'planned' });
    expect(maintenanceCommand(dir, ['status'], out)).toBe(0);
    expect(maintenanceCommand(dir, ['off'], out)).toBe(0);
    expect(maintenanceCommand(dir, ['off'], out)).toBe(0);
    expect(maintenanceCommand(dir, ['status'], out)).toBe(0);
    expect((await get(running.port, '/api/state')).status).toBe(401);
    expect(maintenanceCommand(dir, [], out)).toBe(1);
    expect(maintenanceCommand(dir, ['maybe'], out)).toBe(1);
    expect(lines).toEqual([
      'Maintenance is on: players get „Wartung“ until `nova maintenance off`.',
      'Maintenance is on.',
      'Maintenance is off.',
      'Maintenance is off.',
      'Maintenance is off.',
      'Usage: nova maintenance on|off|status',
      'Usage: nova maintenance on|off|status',
    ]);
    await running.stop();
  });
});

describe('migration in a worker thread', () => {
  it('migrates a database file, and reports why it refuses', async () => {
    const file = path.join(dir, 'nova.sqlite');
    await migrateInWorker(file);
    const db = new Database(file, { readonly: true });
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
    db.close();

    const old = path.join(dir, 'old.sqlite');
    const from = MIGRATIONS.length - 1;
    openDatabase(old, MIGRATIONS.slice(0, from)).close();
    mkdirSync(path.join(dir, `old.sqlite.v${from}.bak`, 'x'), {
      recursive: true,
    });
    await expect(migrateInWorker(old)).rejects.toThrow(
      `No good backup of schema version ${from}`,
    );
  });
});

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}
