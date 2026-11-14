import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 18 adds fleets.gift, the gift fleet of the „Endzeit“ (#161).
describe('upgrade to migration 18', () => {
  it('keeps fleets in flight as they were; none of them is a gift', () => {
    const db = databaseAt(17);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u_Anna', 'Anna', 's', 'h', 1);
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel)
      VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_6', 1, 1, 6,
          'deploy', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41),
        ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'd1_2_6', 1, 2, 6,
          'harvest', 0, 0, 0, 4, 5, 6, 'back', 1, 7);
      INSERT INTO fleet_ships VALUES ('f1', 'sc', 2), ('f2', 'recycler', 3);
    `);
    const before = db
      .prepare('SELECT * FROM fleets ORDER BY id')
      .all() as Record<string, unknown>[];
    expect(migrate(db, MIGRATIONS.slice(0, 18))).toBe(1);
    expect(db.prepare('SELECT * FROM fleets ORDER BY id').all()).toEqual(
      before.map((row) => ({ ...row, gift: 0 })),
    );
    const store = new Store(db);
    expect(store.fleet('f1')).not.toHaveProperty('gift');
    expect(store.fleet('f2')).toMatchObject({
      mission: 'harvest',
      ships: { recycler: 3 },
      recalled: true,
    });
    // Both count as fleet slots; a gift does not, and it reads back as one.
    expect(store.fleetCount('u_Anna')).toBe(2);
    store.saveFleet({ ...store.fleet('f1')!, id: 'f3', gift: true });
    expect(store.fleet('f3')).toMatchObject({ id: 'f3', gift: true });
    expect(store.fleetCount('u_Anna')).toBe(2);
    // A later save of a gift keeps it a gift.
    store.saveFleet({ ...store.fleet('f3')!, state: 'back' });
    expect(store.fleet('f3')).toMatchObject({ state: 'back', gift: true });
    expect(() => db.exec("UPDATE fleets SET gift = 2 WHERE id = 'f1'")).toThrow(
      'CHECK',
    );
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });
});
