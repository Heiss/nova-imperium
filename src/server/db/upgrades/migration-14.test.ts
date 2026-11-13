import { describe, expect, it } from 'vitest';
import { fieldRange, fieldsOf } from '../../../shared/fields.ts';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 14 adds the diameter and the field limit of the planets (#51).
// The planets that exist have no field limit until the next round.
describe('upgrade to migration 14', () => {
  const insertPlanet = `INSERT INTO planets (id, owner, name, g, s, p, temp,
    res_m, res_c, res_d, t, created) VALUES (?, ?, ?, 1, ?, ?, 20, 1, 2, 3, 5, ?)`;

  function oldDatabase() {
    const db = databaseAt(13);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created)
      VALUES ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 1);
    `);
    const put = db.prepare(insertPlanet);
    // Anna: home planet on position 5, colonies on 1, 8, 15 and 20.
    put.run('p1_1_5', 'u_Anna', 'Heimat', 1, 5, 10);
    put.run('p1_1_1', 'u_Anna', 'Innen', 1, 1, 20);
    put.run('p1_1_8', 'u_Anna', 'Mitte', 1, 8, 30);
    put.run('p1_1_15', 'u_Anna', 'Außen', 1, 15, 40);
    put.run('p1_1_20', 'u_Anna', 'Rand', 1, 20, 50);
    // Bert: the oldest planet is home, not the one with the smaller id.
    put.run('p1_2_9', 'u_Bert', 'Heimat', 2, 9, 5);
    put.run('p1_2_3', 'u_Bert', 'Kolonie', 2, 3, 7);
    db.exec(`
      INSERT INTO planet_buildings VALUES ('p1_1_5', 'metal', 30), ('p1_1_5', 'lab', 12);
      UPDATE planets SET bq_key = 'metal', bq_lvl = 31, bq_start = 6, bq_end = 9,
        bq_cost_m = 1, bq_cost_c = 2, bq_cost_d = 0 WHERE id = 'p1_1_5';
    `);
    return db;
  }

  it('gives every existing planet no field limit and keeps its data', () => {
    const db = oldDatabase();
    const before = db.prepare('SELECT * FROM planets ORDER BY id').all();
    expect(migrate(db, MIGRATIONS.slice(0, 14))).toBe(1);
    const after = db
      .prepare('SELECT * FROM planets ORDER BY id')
      .all() as Record<string, unknown>[];
    const old = (row: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([k]) => k !== 'diameter' && k !== 'unlimited',
        ),
      );
    expect(after.map(old)).toEqual(before);
    expect(after.every((r) => r.unlimited === 1)).toBe(true);
    const store = new Store(db);
    expect(store.planet('p1_1_5')).toMatchObject({
      b: { metal: 30, lab: 12 },
      bq: { key: 'metal', lvl: 31 },
      unlimited: true,
    });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('gives a home planet 12,800 km and a colony a diameter from its position', () => {
    for (let run = 0; run < 20; run++) {
      const db = oldDatabase();
      migrate(db, MIGRATIONS.slice(0, 14));
      const store = new Store(db);
      expect(store.planet('p1_1_5')!.diameter).toBe(12800);
      expect(store.planet('p1_2_9')!.diameter).toBe(12800);
      for (const id of ['p1_1_1', 'p1_1_8', 'p1_1_15', 'p1_1_20', 'p1_2_3']) {
        const p = store.planet(id)!;
        const { min, max } = fieldRange(p.p);
        const fields = fieldsOf(p.diameter);
        expect(fields, id).toBeGreaterThanOrEqual(min);
        expect(fields, id).toBeLessThanOrEqual(max);
      }
      db.close();
    }
  });

  it('writes new planets with a limit by default and allows only 0 and 1', () => {
    const db = databaseAt(14);
    db.exec(
      "INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u', 'U', 's', 'h', 1)",
    );
    db.prepare(insertPlanet).run('p1_1_5', 'u', 'X', 1, 5, 1);
    expect(db.prepare('SELECT diameter, unlimited FROM planets').get()).toEqual(
      { diameter: 0, unlimited: 0 },
    );
    expect(() => db.exec('UPDATE planets SET unlimited = 2')).toThrow('CHECK');
    db.close();
  });
});
