// Upgrade test of migration 20261128T0300-attack-union-rows (#466): an
// attack union gets a row of its own. A union in flight (its leader's
// Sturmangriff carries its own ID in `union_id`) becomes a row with that ID,
// the leader's fleet as `lead` and its present arrival as X; its other
// fleets and its invitations keep the ID and change nothing. A fleet whose
// union has no leading fleet out any more gets no row and arrives alone, as
// before. No other table changes.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/466/migrations.ts';
import { Store } from '../store.ts';

const ID = '20261128T0300-attack-union-rows';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/**
 * A running round: Anna's union f1 to Cora with Bert's fleet f2 and an
 * invitation of Dora; f5 is a union whose leading fleet turned back (f5 is
 * „back“), with Bert's fleet f6 in it; f4 is an attack of no union.
 */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 2),
      ('u_Cora', 'Cora', 's', 'h', 3), ('u_Dora', 'Dora', 's', 'h', 4);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 900, 100, 50, 10, 1, 'planet'),
      ('p1_2_6', 'u_Bert', 'Beta', 1, 2, 6, 20, 500, 300, 0, 10, 2, 'planet'),
      ('p1_3_7', 'u_Cora', 'Gamma', 1, 3, 7, 20, 500, 300, 0, 10, 3, 'planet'),
      ('m1_3_7', 'u_Cora', 'Mond', 1, 3, 7, 20, 0, 0, 0, 10, 3, 'moon');
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift, hold, aim, union_id)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_3_7', 1, 3, 7,
        'attack', 0, 0, 0, 100, 5000, 9900, 'out', 0, 41, 0, 0, NULL, 'f1'),
      ('f2', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_3_7', 1, 3, 7,
        'attack', 0, 0, 0, 200, 5000, 9800, 'out', 0, 30, 0, 0, NULL, 'f1'),
      ('f4', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_3_7', 1, 3, 7,
        'attack', 0, 0, 0, 300, 7000, 13700, 'out', 0, 30, 0, 0, NULL, NULL),
      ('f5', 'u_Anna', 'p1_1_5', 1, 1, 5, 'm1_3_7', 1, 3, 7,
        'attack', 0, 0, 0, 100, 6000, 900, 'back', 1, 41, 0, 0, NULL, 'f5'),
      ('f6', 'u_Bert', 'p1_2_6', 1, 2, 6, 'm1_3_7', 1, 3, 7,
        'attack', 0, 0, 0, 400, 6000, 11600, 'out', 0, 30, 0, 0, NULL, 'f5');
    INSERT INTO fleet_ships VALUES ('f1', 'lf', 2), ('f2', 'sc', 1),
      ('f4', 'lf', 1), ('f5', 'lf', 3), ('f6', 'lf', 4);
    INSERT INTO attack_union_invites (union_id, user_id) VALUES ('f1', 'u_Dora');
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('moves the union in flight into a row with its ID, the leader, the target and X its arrival', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = [
      'users',
      'planets',
      'fleets',
      'fleet_ships',
      'attack_union_invites',
    ];
    const old = tables.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'attack_unions')).toEqual([
      {
        id: 'f1',
        leader: 'u_Anna',
        lead: 'f1',
        target: 'p1_3_7',
        to_g: 1,
        to_s: 3,
        to_p: 7,
        arr: 5000,
      },
    ]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('reads the moved union through the repository, and a fleet of a union without a row as before', () => {
    const db = runningRound();
    migrate(db, through);
    const store = new Store(db);
    expect(store.repos.unions.get('f1')).toEqual({
      id: 'f1',
      leader: 'u_Anna',
      lead: 'f1',
      target: 'p1_3_7',
      toC: { g: 1, s: 3, p: 7 },
      arr: 5000,
    });
    expect(store.repos.unions.get('f5')).toBeNull();
    expect(store.fleet('f6')).toMatchObject({ union: 'f5', arr: 6000 });
    db.close();
  });

  it('keeps a union of a deleted account out, and a new union without a leading fleet', () => {
    const db = runningRound();
    migrate(db, through);
    const unions = new Store(db).repos.unions;
    // In SQL: the store writes the columns of the latest schema (#202), which
    // has the planned start of #478 too.
    db.exec(`INSERT INTO attack_unions (id, leader, lead, target, to_g, to_s, to_p, arr)
      VALUES ('u9', 'u_Bert', NULL, 'm1_3_7', 1, 3, 7, 8000)`);
    expect(unions.get('u9')).not.toHaveProperty('lead');
    db.exec(`UPDATE attack_unions SET lead = 'f4' WHERE id = 'u9'`);
    expect(unions.get('u9')).toMatchObject({ lead: 'f4', arr: 8000 });
    db.prepare('DELETE FROM users WHERE id = ?').run('u_Anna');
    expect(unions.get('f1')).toBeNull();
    expect(unions.get('u9')).not.toBeNull();
    db.close();
  });
});
