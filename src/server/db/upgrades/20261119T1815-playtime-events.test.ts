// Upgrade test of migration 20261119T1815-playtime-events (#232): the new,
// empty table of the accepted play time intervals. A running round keeps
// every row of every other table, the old activity sums stay as they are
// (they are not decomposed into intervals), and the first interval of a
// player is the capture start of the own view.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/232/migrations.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';
import { createCtx } from '../../game/context.ts';
import { ownActivity, recordPlaytime } from '../../game/playtime.ts';

const ID = '20261119T1815-playtime-events';
const through = migrationsThrough(ID);
const NOW = 1763300000000;

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: Anna with a planet and the old activity sums of two days. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at) VALUES
      ('u_Anna', 'Anna', 's', 'h', ${NOW - 50 * 86_400_000}, 3, 0);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, ${NOW}, ${NOW - 50 * 86_400_000}, 'planet');
    INSERT INTO player_activity (player, day, last_seen, active_ms) VALUES
      ('u_Anna', ${NOW - 2 * 86_400_000}, ${NOW - 2 * 86_400_000 + 5000}, 600000),
      ('u_Anna', ${NOW - 86_400_000}, ${NOW - 20 * 60000}, 1200000);
    INSERT INTO settings (key, value) VALUES ('round', 2);
  `);
  return db;
}

const TABLES = ['users', 'planets', 'player_activity', 'settings'];

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty table and keeps the data, the old sums included', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const old = TABLES.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(TABLES.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'playtime_events')).toEqual([]);
    db.close();
  });

  it('records from the first report on and never from the old sums', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const clock = { t: NOW };
    const ctx = createCtx(new Store(db), { now: () => clock.t });
    const anna = ctx.players.get('u_Anna')!;
    expect(ownActivity(ctx, anna)).toMatchObject({
      since: null,
      roundMs: 0,
      totalMs: 0,
      round: 2,
    });
    const page = { instance: 'page-0001', state: 'active' };
    recordPlaytime(ctx, anna, { ...page, seq: 0, since: null });
    clock.t += 30_000;
    recordPlaytime(ctx, anna, { ...page, seq: 1, since: 30_000 });
    expect(ownActivity(ctx, anna)).toMatchObject({
      since: NOW,
      roundMs: 30_000,
      totalMs: 30_000,
    });
    expect(all(db, 'player_activity')).toHaveLength(2);
    expect(all(db, 'playtime_events')[0]).toMatchObject({
      user_id: 'u_Anna',
      round: 2,
      play_session: 1,
      method: 1,
    });
    db.close();
  });

  it('refuses a state, a reason and a second report of a page that the table does not know', () => {
    const db = runningRound();
    migrate(db, through);
    const row = (state: string, reason: string, seq = 0) =>
      db
        .prepare(
          `INSERT INTO playtime_events (user_id, round, play_session, instance, seq, state, reason, start_ms, end_ms, method)
           VALUES ('u_Anna', 1, 1, 'page-0001', ?, ?, ?, 0, 0, 1)`,
        )
        .run(seq, state, reason);
    expect(() => row('asleep', 'start')).toThrow('CHECK constraint failed');
    expect(() => row('active', 'because')).toThrow('CHECK constraint failed');
    row('active', 'start');
    expect(() => row('active', 'heartbeat')).toThrow(
      'UNIQUE constraint failed',
    );
    db.close();
  });

  it('goes with its account', () => {
    const db = runningRound();
    migrate(db, through);
    db.exec(`INSERT INTO playtime_events
      (user_id, round, play_session, instance, seq, state, reason, start_ms, end_ms, method)
      VALUES ('u_Anna', 1, 1, 'page-0001', 0, 'active', 'start', 5, 5, 1)`);
    db.prepare('DELETE FROM users WHERE id = ?').run('u_Anna');
    expect(all(db, 'playtime_events')).toEqual([]);
    db.close();
  });
});
