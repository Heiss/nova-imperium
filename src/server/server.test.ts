import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY } from './audit.ts';
import { tick } from './game/arrival.ts';
import {
  clockBeat,
  databaseFile,
  DB_FILE,
  hourlySweep,
  jobFailure,
  pushFailure,
  startServer,
} from './server.ts';
import { addUser, testConfig, testCtx } from './test-helpers.ts';

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

  it('logs a failed background job as before and records it (#126)', () => {
    const ctx = testCtx();
    const logs: unknown[][] = [];
    const log = (...args: unknown[]) => logs.push(args);
    const error = new Error('broken');
    jobFailure(ctx, log, 'arrival', '26.11.21')('Fleet f1 failed', error);
    jobFailure(ctx, log, 'tick')('Tick failed', 'x');
    expect(logs).toEqual([
      ['Fleet f1 failed', error],
      ['Tick failed', 'x'],
    ]);
    expect(
      ctx.store.db
        .prepare('SELECT kind, action, version, message FROM error_events')
        .all(),
    ).toEqual([
      {
        kind: 'server',
        action: 'arrival',
        version: '26.11.21',
        message: 'Fleet f1 failed: Error: broken',
      },
      {
        kind: 'server',
        action: 'tick',
        version: '',
        message: 'Tick failed: x',
      },
    ]);
  });

  it('records a fleet that fails on arrival (#126)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.store.db
      .prepare(
        `INSERT INTO fleets VALUES ('f1', 'u_Anna', 'p1', 1, 1, 1, 'p2', 1, 1, 2,
          'transport', 0, 0, 0, 0, 1, 2, 'out', 0)`,
      )
      .run();
    const broken = {
      ...ctx,
      store: Object.create(ctx.store, {
        planet: {
          value: () => {
            throw new Error('lost planet');
          },
        },
      }) as typeof ctx.store,
    };
    expect(
      tick(
        broken,
        jobFailure(ctx, () => {}, 'arrival'),
      ),
    ).toBe(1);
    expect(
      ctx.store.db.prepare('SELECT action, message FROM error_events').all(),
    ).toEqual([
      {
        action: 'arrival',
        message: 'Fleet f1 failed and was removed: Error: lost planet',
      },
    ]);
  });
});

// The background jobs of the running server (issue #126): each failure is
// logged as before and lands in the error log.
describe('background jobs', () => {
  const errors = (ctx: ReturnType<typeof testCtx>) =>
    ctx.store.db
      .prepare('SELECT action, version, message FROM error_events')
      .all();
  const addFleet = (ctx: ReturnType<typeof testCtx>, state: string) =>
    ctx.store.db
      .prepare(
        `INSERT INTO fleets VALUES ('f1', 'u_Anna', 'p1', 1, 1, 1, 'p2', 1, 1, 2,
          'transport', 0, 0, 0, 0, 1, 2, ?, 0)`,
      )
      .run(state);

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a clock beat lands due fleets quietly', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addFleet(ctx, 'back');
    const log = vi.fn();
    clockBeat(ctx, log, '26.11.21');
    expect(ctx.store.fleet('f1')).toBeNull();
    expect(log).not.toHaveBeenCalled();
    expect(errors(ctx)).toEqual([]);
  });

  it('a clock beat records a failed arrival and a failed tick', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addFleet(ctx, 'out');
    const log = vi.fn();
    vi.spyOn(ctx.store, 'planet').mockImplementation(() => {
      throw new Error('lost planet');
    });
    clockBeat(ctx, log, '26.11.21');
    const broken = new Error('no fleets');
    vi.spyOn(ctx.store, 'dueFleets').mockImplementation(() => {
      throw broken;
    });
    clockBeat(ctx, log, null);
    expect(log.mock.calls).toEqual([
      ['Fleet f1 failed and was removed', expect.any(Error)],
      ['Tick failed', broken],
    ]);
    expect(errors(ctx)).toEqual([
      {
        action: 'arrival',
        version: '26.11.21',
        message: 'Fleet f1 failed and was removed: Error: lost planet',
      },
      { action: 'tick', version: '', message: 'Tick failed: Error: no fleets' },
    ]);
  });

  it('the hourly sweep purges sessions, audit and error log and the app', () => {
    const ctx = testCtx(40 * DAY);
    addUser(ctx, 'Anna');
    ctx.store.db.exec(`
      INSERT INTO sessions VALUES ('old', 'u_Anna', ${40 * DAY}),
        ('new', 'u_Anna', ${40 * DAY + 1});
      INSERT INTO audit_events (time, category, action, outcome, detail)
      VALUES (1, 'system', 'old', 'ok', '{}');
      INSERT INTO error_events (kind, time, first, action, page, version,
        browser, message, detail, report)
      VALUES ('server', 1, 1, 'old', '', '', '', '', '', '');
    `);
    const sweepApp = vi.fn();
    const log = vi.fn();
    hourlySweep(ctx, sweepApp, log, null);
    expect(
      ctx.store.db.prepare('SELECT token_hash FROM sessions').pluck().all(),
    ).toEqual(['new']);
    expect(
      ctx.store.db.prepare('SELECT COUNT(*) FROM audit_events').pluck().get(),
    ).toBe(0);
    expect(errors(ctx)).toEqual([]);
    expect(sweepApp).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('a failed sweep is logged and recorded instead of thrown', () => {
    const ctx = testCtx();
    const log = vi.fn();
    const broken = new Error('sweep broke');
    hourlySweep(
      ctx,
      () => {
        throw broken;
      },
      log,
      '26.11.21',
    );
    expect(log.mock.calls).toEqual([['Sweep failed', broken]]);
    expect(errors(ctx)).toEqual([
      {
        action: 'sweep',
        version: '26.11.21',
        message: 'Sweep failed: Error: sweep broke',
      },
    ]);
  });

  it('a failed push delivery keeps its short console line', () => {
    const ctx = testCtx();
    const log = vi.fn();
    pushFailure(ctx, log, '26.11.21')(new Error('gone'));
    expect(log.mock.calls).toEqual([['Web Push delivery failed']]);
    expect(errors(ctx)).toEqual([
      { action: 'push', version: '26.11.21', message: 'Error: gone' },
    ]);
  });

  it('the running server beats every second, sweeps every hour and stops both', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const logs: unknown[][] = [];
    const s = await startServer({
      cfg: testConfig(),
      publicDir: PUBLIC,
      dbFile: ':memory:',
      mailer: null,
      log: (...args) => logs.push(args),
    });
    const ctx = s.ctx!;
    const due = vi.spyOn(ctx.store, 'dueFleets');
    const purge = vi.spyOn(ctx.store, 'purgeSessions');
    vi.advanceTimersByTime(999);
    expect(due).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(due).toHaveBeenCalledTimes(1);
    expect(purge).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3600000 - 1000);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(due).toHaveBeenCalledTimes(3600);
    await s.stop();
    vi.advanceTimersByTime(2 * 3600000);
    expect(due).toHaveBeenCalledTimes(3600);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(logs).toEqual([]);
  });
});
