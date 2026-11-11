// The real server process refuses to start when it cannot back up the
// database before a migration, and leaves the database file as it was.
import { spawnSync } from 'node:child_process';
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

const hash = (f: string): string =>
  createHash('sha256').update(readFileSync(f)).digest('hex');

describe('server start', () => {
  it('stops without a good backup and leaves the database as it was', () => {
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

    const run = spawnSync(process.execPath, ['src/server/main.ts'], {
      env: {
        ...process.env,
        NOVA_PUBLIC_URL: 'http://localhost:8097',
        NOVA_PORT: '8097',
        NOVA_HOST: '127.0.0.1',
        NOVA_DATA_DIR: dir,
      },
      encoding: 'utf8',
      timeout: 30_000,
    });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(`No good backup of schema version ${from}`);
    expect(run.stderr).toContain('did not migrate; the database is unchanged');
    expect(run.stdout).not.toContain('listens on');
    expect(hash(file)).toBe(before);
  });
});
