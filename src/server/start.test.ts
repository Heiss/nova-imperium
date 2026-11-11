// The real server process refuses to migrate when it cannot back up the
// database, stays in maintenance instead of exiting (no restart loop) and
// leaves the database file as it was.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './db/database.ts';
import { MIGRATIONS } from './db/schema.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-start-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 300 && !done(); i++)
    await new Promise((r) => setTimeout(r, 100));
  expect(done()).toBe(true);
}

const hash = (f: string): string =>
  createHash('sha256').update(readFileSync(f)).digest('hex');

describe('server start', () => {
  it('stays in maintenance without a good backup and leaves the database as it was', async () => {
    const file = path.join(dir, 'nova.sqlite');
    const from = MIGRATIONS.length - 1;
    const db = openDatabase(file, MIGRATIONS.slice(0, from));
    db.exec("INSERT INTO settings (key, value) VALUES ('start-test', 42)");
    db.close();
    const before = hash(file);
    // A folder where the backup file should go: the copy fails.
    mkdirSync(path.join(dir, `nova.sqlite.v${from}.bak`, 'x'), {
      recursive: true,
    });

    const child = spawn(process.execPath, ['src/server/main.ts'], {
      env: {
        ...process.env,
        NOVA_PUBLIC_URL: 'http://localhost:8097',
        NOVA_PORT: '8097',
        NOVA_HOST: '127.0.0.1',
        NOVA_DATA_DIR: dir,
      },
    });
    const exited = new Promise((r) => child.once('exit', r));
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
    try {
      await until(() => stdout.includes('Wartung'));
      const health = await fetch('http://127.0.0.1:8097/healthz');
      expect(health.status).toBe(503);
      expect(health.headers.get('nova-maintenance')).toBe('stopped');
      const game = await fetch('http://127.0.0.1:8097/api/state');
      expect(await game.json()).toEqual({
        error:
          'Nova Imperium ist wegen Wartung nicht erreichbar. Der Betreiber ist informiert.',
        maintenance: 'stopped',
      });
      expect(child.exitCode).toBeNull();
    } finally {
      child.kill();
      await exited;
    }
    expect(stderr).toContain(`No good backup of schema version ${from}`);
    expect(stderr).toContain('did not migrate; the database is unchanged');
    expect(stdout).not.toContain('listens on');
    expect(hash(file)).toBe(before);
  });
});
