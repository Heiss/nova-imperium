import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 10 adds the planet where the running research started (#49).
describe('upgrade to migration 10', () => {
  it('keeps running research; it has no planet and counts as the home planet', () => {
    const db = databaseAt(9);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created,
        rq_key, rq_lvl, rq_start, rq_end, rq_cost_m, rq_cost_c, rq_cost_d)
      VALUES ('u1', 'Anna', 's', 'h', 1, 'energy', 2, 10, 20, 0, 1600, 800),
        ('u2', 'Bert', 's', 'h', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
      INSERT INTO user_research VALUES ('u1', 'energy', 1);
    `);
    expect(migrate(db, MIGRATIONS.slice(0, 10))).toBe(1);
    const store = new Store(db);
    expect(store.user('u1')).toMatchObject({
      research: { energy: 1 },
      rq: { key: 'energy', lvl: 2, start: 10, end: 20, cost: [0, 1600, 800] },
    });
    expect(store.user('u1')!.rq).not.toHaveProperty('planet');
    expect(store.user('u2')!.rq).toBeNull();
    const u = store.user('u1')!;
    store.saveUser({ ...u, rq: { ...u.rq!, planet: 'p1' } });
    expect(store.user('u1')!.rq).toMatchObject({ key: 'energy', planet: 'p1' });
    store.saveUser({ ...u, rq: null });
    expect(
      db.prepare('SELECT rq_key, rq_planet FROM users WHERE id = ?').get('u1'),
    ).toEqual({ rq_key: null, rq_planet: null });
    db.close();
  });
});
