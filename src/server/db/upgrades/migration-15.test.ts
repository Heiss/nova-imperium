import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  databaseAt,
  plansBefore,
  snapshot,
  upgrade,
} from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 15 (#119, O11): a place is coordinates plus a kind. It rebuilds
// planets with `kind` and UNIQUE (g, s, p, kind), its four child tables with
// it, and adds the empty table of the debris fields.
const CHILDREN = [
  'planet_buildings',
  'planet_units',
  'planet_production',
  'shipyard_queue',
];

type Rows = Record<string, unknown>[];

/** The rows of a table in a fixed order, for comparisons. */
const sorted = (rows: Rows): string[] =>
  rows.map((r) => JSON.stringify(r)).sort();

const withoutKind = (rows: Rows): Rows =>
  rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'kind')),
  );

function oldDatabase() {
  const db = databaseAt(14);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created)
    VALUES ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 1);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d,
      t, created, sq_t, bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c,
      bq_cost_d, diameter, unlimited)
    VALUES
      ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 1.5, 2.25, 3, 7, 1, 9,
        'metal', 31, 6, 9, 1, 2, 0, 12800, 1),
      ('p1_1_6', 'u_Anna', 'Kolonie', 1, 1, 6, 30, 0, 0, 0, 8, 2, NULL,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11000, 0),
      ('p2_499_15', 'u_Bert', 'Rand', 2, 499, 15, -40, 1e15, 0, 0, 9, 3,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 9000, 1);
    INSERT INTO planet_buildings VALUES ('p1_1_5', 'metal', 30),
      ('p1_1_5', 'lab', 12), ('p2_499_15', 'yard', 2);
    INSERT INTO planet_units VALUES ('p1_1_5', 'ship', 'lf', 3),
      ('p1_1_5', 'defense', 'rl', 7), ('p1_1_6', 'ship', 'colony', 1);
    INSERT INTO planet_production VALUES ('p1_1_5', 'metal', 50),
      ('p1_1_6', 'solar', 100);
    INSERT INTO shipyard_queue VALUES ('p1_1_5', 0, 'lf', 2, 1000.5),
      ('p1_1_5', 1, 'rl', 4, 50);
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p,
      to_planet, to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep,
      arr, ret, state, recalled, fuel)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p2_499_15', 2, 499, 15,
      'attack', 0, 0, 0, 1, 2, 3, 'out', 0, 12);
  `);
  return db;
}

const all = (db: ReturnType<typeof databaseAt>, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table}`).all() as Rows;

describe('upgrade to migration 15', () => {
  it('keeps every planet with its id, data and children, as kind planet', () => {
    const db = oldDatabase();
    const store = new Store(db);
    const planets = ['p1_1_5', 'p1_1_6', 'p2_499_15'];
    const read = () => planets.map((id) => store.planet(id));
    const before = read();
    const rows = all(db, 'planets');
    const children = CHILDREN.map((t) => sorted(all(db, t)));
    const fleets = store.fleets();

    expect(migrate(db, MIGRATIONS.slice(0, 15))).toBe(1);

    expect(read()).toEqual(before.map((p) => ({ ...p, kind: 'planet' })));
    expect(sorted(withoutKind(all(db, 'planets')))).toEqual(sorted(rows));
    expect(
      db.prepare('SELECT DISTINCT kind FROM planets').pluck().all(),
    ).toEqual(['planet']);
    expect(CHILDREN.map((t) => sorted(all(db, t)))).toEqual(children);
    expect(store.fleets()).toEqual(fleets);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'old_%'")
        .all(),
    ).toEqual([]);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'planets' AND sql IS NOT NULL",
        )
        .pluck()
        .all(),
    ).toEqual(['planets_owner']);
    db.close();
  });

  it('allows a moon at the coordinates of a planet, but no second planet', () => {
    const db = oldDatabase();
    migrate(db, MIGRATIONS.slice(0, 15));
    const store = new Store(db);
    store.savePlanet({
      ...store.planet('p1_1_5')!,
      id: 'm1_1_5',
      kind: 'moon',
    });
    expect(store.planet('m1_1_5')).toMatchObject({ kind: 'moon', g: 1, p: 5 });
    expect(() =>
      db.exec(`UPDATE planets SET g = 1, s = 1, p = 5 WHERE id = 'p1_1_6'`),
    ).toThrow('UNIQUE constraint failed');
    // Debris has its own table, no other kind is a planet.
    expect(() =>
      db.exec(`UPDATE planets SET kind = 'debris' WHERE id = 'p1_1_6'`),
    ).toThrow('CHECK constraint failed');
    db.close();
  });

  it('still deletes the children with their planet', () => {
    const db = oldDatabase();
    migrate(db, MIGRATIONS.slice(0, 15));
    db.exec(`DELETE FROM users WHERE id = 'u_Anna'`);
    expect(db.prepare('SELECT id FROM planets').pluck().all()).toEqual([
      'p2_499_15',
    ]);
    for (const t of CHILDREN)
      expect(
        db.prepare(`SELECT DISTINCT planet_id FROM ${t}`).pluck().all(),
        t,
      ).toEqual(t === 'planet_buildings' ? ['p2_499_15'] : []);
    db.close();
  });

  it('adds the debris fields empty, one per position', () => {
    const db = oldDatabase();
    migrate(db, MIGRATIONS.slice(0, 15));
    expect(all(db, 'debris')).toEqual([]);
    db.exec(`INSERT INTO debris VALUES ('d1_1_5', 1, 1, 5, 300.5, 0)`);
    expect(all(db, 'debris')).toEqual([
      { id: 'd1_1_5', g: 1, s: 1, p: 5, res_m: 300.5, res_c: 0 },
    ]);
    expect(() =>
      db.exec(`INSERT INTO debris VALUES ('d_other', 1, 1, 5, 1, 1)`),
    ).toThrow('UNIQUE constraint failed: debris.g, debris.s, debris.p');
    expect(() =>
      db.exec(`INSERT INTO debris VALUES ('d1_1_6', 1, 1, 6, 'x', 1)`),
    ).toThrow('cannot store TEXT value in REAL column debris.res_m');
    expect(() =>
      db.exec(`INSERT INTO debris VALUES ('d1_1_7', 1, 1, 7, 1, NULL)`),
    ).toThrow('NOT NULL constraint failed: debris.res_c');
    db.close();
  });

  it('keeps all data of any valid database of version 14', () => {
    fc.assert(
      fc.property(plansBefore(15), (plan) => {
        const { before, after } = upgrade(15, plan);
        const rows = (s: ReturnType<typeof snapshot>, t: string): Rows =>
          JSON.parse(s.data.get(t)!) as Rows;
        for (const t of before.data.keys()) {
          const old = sorted(rows(before, t));
          const now = rows(after, t);
          if (t === 'planets') {
            expect(now.every((r) => r.kind === 'planet')).toBe(true);
            expect(sorted(withoutKind(now)), t).toEqual(old);
          } else expect(sorted(now), t).toEqual(old);
        }
        expect(rows(after, 'debris')).toEqual([]);
      }),
      { numRuns: 50, seed: 119 },
    );
  });
});
