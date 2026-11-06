import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { databaseFile, DB_FILE, startServer } from './server.ts';
import { testConfig } from './test-helpers.ts';

const PUBLIC = path.resolve(import.meta.dirname, '../test/public');

describe('server', () => {
  it('creates the data folder, starts, keeps data over a restart and stops', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nova-'));
    try {
      const cfg = testConfig({ dataDir: path.join(dir, 'data') });
      expect(databaseFile(cfg)).toBe(path.join(dir, 'data', DB_FILE));
      const first = await startServer({
        cfg,
        publicDir: PUBLIC,
        mailer: null,
        log: () => {},
      });
      expect(first.port).toBeGreaterThan(0);
      const res = await fetch(`http://127.0.0.1:${first.port}/healthz`);
      expect(await res.json()).toEqual({ ok: true });
      first.ctx.store.saveUniverse({ ...first.ctx.store.universe(), speed: 7 });
      await first.stop();
      const second = await startServer({
        cfg,
        publicDir: PUBLIC,
        log: () => {},
      });
      expect(second.ctx.store.universe().speed).toBe(7);
      await second.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates a mailer when SMTP is set', async () => {
    const cfg = testConfig({
      smtp: {
        host: '127.0.0.1',
        port: 1,
        tls: 'false',
        username: '',
        password: '',
        from: 'a@b.c',
      },
    });
    const s = await startServer({ cfg, publicDir: PUBLIC, dbFile: ':memory:' });
    await s.stop();
  });
});
