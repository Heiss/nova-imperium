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
      first.ctx!.store.saveUniverse({
        ...first.ctx!.store.universe(),
        speed: 7,
      });
      await first.stop();
      const second = await startServer({
        cfg,
        publicDir: PUBLIC,
        log: () => {},
      });
      expect(second.ctx!.store.universe().speed).toBe(7);
      await second.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tells the players about a new version at the start and serves the news', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nova-'));
    try {
      const cfg = testConfig({ dataDir: path.join(dir, 'data') });
      const logs: string[] = [];
      const versions = [
        {
          version: '26.11.1',
          date: '12.11.2026',
          entries: [{ kind: 'neu' as const, text: 'Neuigkeiten.' }],
        },
      ];
      const first = await startServer({
        cfg,
        publicDir: PUBLIC,
        log: (m) => logs.push(m),
        news: { version: '26.11.0', versions },
      });
      first
        .ctx!.store.db.prepare(
          "INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Anna', 's', 'h', 0)",
        )
        .run();
      await first.stop();
      const second = await startServer({
        cfg,
        publicDir: PUBLIC,
        log: (m) => logs.push(m),
        news: { version: '26.11.1', versions },
      });
      expect(second.ctx!.store.reports('u1')).toMatchObject([
        { title: 'Neu in Version 26.11.1' },
      ]);
      expect(logs).toEqual(['Told 1 players about version 26.11.1.']);
      await second.stop();
      const third = await startServer({
        cfg,
        publicDir: PUBLIC,
        log: () => {},
      });
      expect(third.ctx!.store.reports('u1')).toHaveLength(1);
      await third.stop();
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
