// Upgrade test of migration 20261117T0923-activity-times (#229): the time
// of the last activity per planet and moon and per account. Every planet
// starts without activity; an account starts with its last interaction of
// the private activity samples, without one the server counts from its
// creation; everything else stays.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/229/migrations.ts';
import { Store } from '../store.ts';
import { MIGRATIONS } from '../schema.ts';
import { createCtx } from '../../game/context.ts';
import { recordActivity } from '../../game/activity.ts';
import { stateFor } from '../../game/state.ts';

const ID = '20261117T0923-activity-times';
const through = migrationsThrough(ID);
const DAY = 86_400_000;
const NOW = 1763300000000;

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/**
 * A running round: Anna with her home planet, a colony and a moon and two
 * days of samples; Bert without samples, created 40 days ago; Cara with
 * one sample of 10 days ago.
 */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at, main_planet, main_switched) VALUES
      ('u_Anna', 'Anna', 's', 'h', ${NOW - 50 * DAY}, 3, 0, 'p2_5_9', ${NOW - 2 * DAY}),
      ('u_Bert', 'Bert', 's', 'h', ${NOW - 40 * DAY}, 1, 0, NULL, NULL),
      ('u_Cara', 'Cara', 's', 'h', ${NOW - 45 * DAY}, 1, 0, NULL, NULL);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, ${NOW}, ${NOW - 50 * DAY}, 'planet'),
      ('p2_5_9', 'u_Anna', 'Kolonie', 2, 5, 9, -10, 10, 0, 0, ${NOW}, ${NOW - 20 * DAY}, 'planet'),
      ('m1_2_3', 'u_Anna', 'Mond', 1, 2, 3, 40, 0, 0, 0, ${NOW}, ${NOW - 10 * DAY}, 'moon'),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, ${NOW}, ${NOW - 40 * DAY}, 'planet'),
      ('p1_4_8', 'u_Cara', 'Heimatplanet', 1, 4, 8, 20, 500, 300, 0, ${NOW}, ${NOW - 45 * DAY}, 'planet');
    INSERT INTO player_activity (player, day, last_seen, active_ms) VALUES
      ('u_Anna', ${NOW - 2 * DAY - 1000}, ${NOW - 2 * DAY + 5000}, 60000),
      ('u_Anna', ${NOW - DAY - 1000}, ${NOW - 20 * 60000}, 120000),
      ('u_Cara', ${NOW - 10 * DAY - 1000}, ${NOW - 10 * DAY}, 1000);
    INSERT INTO settings (key, value) VALUES ('round', 2), ('speed', 3);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds no planet activity, the last sample as the account activity, and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['player_activity', 'settings'];
    const old = tables.map((t) => all(db, t));
    const users = all(db, 'users');
    const planets = all(db, 'planets');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'planets')).toEqual(
      planets.map((p) => ({ ...p, active_at: null })),
    );
    const last: Record<string, number | null> = {
      u_Anna: NOW - 20 * 60000,
      u_Bert: null,
      u_Cara: NOW - 10 * DAY,
    };
    expect(all(db, 'users')).toEqual(
      users.map((u) => ({ ...u, active_at: last[u.id as string] })),
    );
    db.close();
  });

  it('shows the inactivity from the start, no planet activity, and records new activity', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const store = new Store(db);
    let now = NOW;
    const ctx = createCtx(store, { now: () => now });
    // Bert counts from his creation 40 days ago, Cara from her sample.
    expect(ctx.players.lastActive()).toEqual({
      u_Anna: NOW - 20 * 60000,
      u_Bert: NOW - 40 * DAY,
      u_Cara: NOW - 10 * DAY,
    });
    const anna = store.user('u_Anna')!;
    const shown = stateFor(ctx, anna) as {
      players: Record<string, { inactive?: string }>;
      galaxy: { id: string; activity?: unknown }[];
    };
    expect(shown.players.u_Anna!.inactive).toBeUndefined();
    expect(shown.players.u_Bert!.inactive).toBe('long');
    expect(shown.players.u_Cara!.inactive).toBe('inactive');
    expect(shown.galaxy.filter((p) => p.activity)).toEqual([]);
    // A login of Anna marks her chosen main planet, a later action all.
    recordActivity(ctx, anna, 'login');
    expect(ctx.planets.activeTimes()).toEqual({ p2_5_9: NOW });
    now += 60000;
    recordActivity(ctx, anna, 'action');
    expect(ctx.planets.activeTimes()).toEqual({
      p1_2_3: now,
      p2_5_9: now,
      m1_2_3: now,
    });
    expect(ctx.players.lastActive().u_Anna).toBe(now);
    // Saving a planet keeps its activity.
    ctx.planets.save(ctx.planets.get('p1_2_3')!);
    expect(ctx.planets.activeTimes().p1_2_3).toBe(now);
    store.saveUser(store.user('u_Anna')!);
    expect(ctx.players.lastActive().u_Anna).toBe(now);
    db.close();
  });
});
