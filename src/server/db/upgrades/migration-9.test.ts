import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 9 rebuilds fleets and fleet_ships for colonization and keys
// queued building and shipyard pushes by the home planet.
describe('upgrade to migration 9', () => {
  it('preserves ships of an in-flight fleet when adding colonization', () => {
    const db = databaseAt(8);
    const store = new Store(db);
    // Written with the columns of version 8; the store writes the newest
    // schema, which has more fleet columns since migration 12.
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u_Anna', 'Anna', 's', 'h', 1);
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled)
      VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_6', 1, 1, 6,
        'transport', 100, 0, 0, 1, 2, 3, 'out', 0);
      INSERT INTO fleet_ships VALUES ('f1', 'sc', 2);
    `);
    const owner = 'u_Anna';
    const fleet = {
      id: 'f1',
      owner,
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_1_6',
      toC: { g: 1, s: 1, p: 6 },
      mission: 'transport' as const,
      ships: { sc: 2 },
      cargo: { m: 100, c: 0, d: 0 },
      dep: 1,
      arr: 2,
      ret: 3,
      state: 'out' as const,
      recalled: false,
    };
    expect(migrate(db, MIGRATIONS.slice(0, 9))).toBe(1);
    expect(store.fleet(fleet.id)).toEqual(fleet);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    store.deleteFleet(fleet.id);
    expect(db.prepare('SELECT * FROM fleet_ships').all()).toEqual([]);
    db.close();
  });

  it('keys building and shipyard pushes by the oldest planet only', () => {
    const db = databaseAt(8);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES
        ('u1', 'Anna', 's', 'h', 1), ('u2', 'Bert', 's', 'h', 1);
      INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created) VALUES
        ('p2', 'u1', 'Zwei', 1, 1, 2, 0, 0, 0, 0, 0, 5),
        ('p1', 'u1', 'Eins', 1, 1, 1, 0, 0, 0, 0, 0, 5),
        ('p3', 'u1', 'Drei', 1, 1, 3, 0, 0, 0, 0, 0, 9);
      INSERT INTO push_subscriptions VALUES ('e1', 'u1', 'k', 'a'), ('e2', 'u2', 'k', 'a');
      INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at) VALUES
        ('e1', 'buildings', 'mine', 1, 1),
        ('e1', 'shipyard', 'q', 1, 1),
        ('e1', 'fleet', 'f1', 1, 1),
        ('e2', 'buildings', 'mine', 1, 1);
    `);
    expect(migrate(db, MIGRATIONS.slice(0, 9))).toBe(1);
    const keys = db
      .prepare(
        'SELECT endpoint, kind, event_key FROM push_jobs ORDER BY endpoint, kind',
      )
      .all();
    expect(keys).toEqual([
      { endpoint: 'e1', kind: 'buildings', event_key: 'p1:mine' },
      { endpoint: 'e1', kind: 'fleet', event_key: 'f1' },
      { endpoint: 'e1', kind: 'shipyard', event_key: 'p1:q' },
      // A player without a planet keeps the old key.
      { endpoint: 'e2', kind: 'buildings', event_key: 'mine' },
    ]);
    db.close();
  });
});
