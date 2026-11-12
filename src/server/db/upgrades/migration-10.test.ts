import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPLAIN } from '../../../shared/explain.ts';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';

// Migration 10 adds the display option of the explanation texts (issue #63).
describe('upgrade to migration 10', () => {
  it('keeps existing players and gives them the default „(?)-Symbol“ (D2)', () => {
    const db = databaseAt(9);
    db.exec(`
      INSERT INTO users (id, name, email, salt, pw_hash, admin, probes, read_at, created)
        VALUES ('u1', 'Anna', 'anna@example.org', 's', 'h', 1, 7, 5, 1),
               ('u2', 'Bert', NULL, 't', 'i', 0, 1, 0, 2);
    `);
    const before = db.prepare('SELECT * FROM users ORDER BY id').all();
    expect(migrate(db, MIGRATIONS.slice(0, 10))).toBe(1);
    const after = db.prepare('SELECT * FROM users ORDER BY id').all();
    expect(after).toEqual(
      before.map((row) => ({
        ...(row as object),
        explain_mode: DEFAULT_EXPLAIN,
      })),
    );
    db.close();
  });

  it('accepts only the three modes', () => {
    const db = databaseAt(10);
    const add = (id: string, mode: string) =>
      db
        .prepare(
          `INSERT INTO users (id, name, salt, pw_hash, created, explain_mode)
           VALUES (?, ?, 's', 'h', 1, ?)`,
        )
        .run(id, id, mode);
    for (const mode of ['always', 'icon', 'hidden']) add(mode, mode);
    expect(() => add('bad', 'never')).toThrow(/CHECK constraint failed/);
    expect(() =>
      db.exec(
        `INSERT INTO users (id, name, salt, pw_hash, created, explain_mode)
         VALUES ('null', 'null', 's', 'h', 1, NULL)`,
      ),
    ).toThrow(/NOT NULL constraint failed/);
    db.close();
  });
});
