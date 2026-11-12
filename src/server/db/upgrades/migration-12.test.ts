import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';

// Migration 12 adds the error log of issue #126: a new table only. Existing
// players and audit entries stay as they were; the log starts empty and its
// rows follow their players when an account is deleted.
describe('upgrade to migration 12', () => {
  it('keeps existing data and starts an empty error log', () => {
    const db = databaseAt(11);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created)
      VALUES ('u1', 'Anna', 's', 'h', 1), ('u2', 'Bert', 's', 'h', 1);
      INSERT INTO audit_events (time, actor, category, action, outcome, detail)
      VALUES (5, 'u1', 'game', 'build', 'ok', '{}');
    `);
    expect(migrate(db, MIGRATIONS.slice(0, 12))).toBe(1);
    expect(db.prepare('SELECT id, name FROM users ORDER BY id').all()).toEqual([
      { id: 'u1', name: 'Anna' },
      { id: 'u2', name: 'Bert' },
    ]);
    expect(db.prepare('SELECT action FROM audit_events').all()).toEqual([
      { action: 'build' },
    ]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM error_events').get()).toEqual({
      n: 0,
    });
    const insert = db.prepare(`
      INSERT INTO error_events (kind, time, first, player, action, page,
        version, browser, message, detail, report)
      VALUES (?, 1, 1, ?, 'x', '', '', '', '', '', '')
    `);
    insert.run('report', 'u1');
    insert.run('client', 'u2');
    expect(() => insert.run('other', 'u1')).toThrow(/CHECK/);
    db.prepare("DELETE FROM users WHERE id = 'u1'").run();
    expect(
      db.prepare('SELECT kind, player, count FROM error_events').all(),
    ).toEqual([{ kind: 'client', player: 'u2', count: 1 }]);
    db.close();
  });
});
