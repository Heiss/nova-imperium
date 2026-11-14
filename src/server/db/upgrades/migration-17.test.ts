import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';

// Migration 17 adds the push kinds a player switched off and the kind of
// each queued push (issue #192).
describe('upgrade to migration 17', () => {
  it('keeps queued pushes; orders and fleets get their kind, reports none', () => {
    const db = databaseAt(16);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Anna', 's', 'h', 1);
      INSERT INTO push_subscriptions VALUES ('https://push.example/1', 'u1', 'k', 'a');
      INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at, attempts, body)
        VALUES ('https://push.example/1', 'buildings', 'p1:1', 2.5, 3.5, 1, NULL),
               ('https://push.example/1', 'research', '7', 4, 4, 0, NULL),
               ('https://push.example/1', 'shipyard', 'p1:9', 5, 5, 0, NULL),
               ('https://push.example/1', 'fleet', 'f1', 6, 6, 0, NULL),
               ('https://push.example/1', 'messages', 'r1', 7, 7, 2, 'Servernachricht: Hallo');
    `);
    const before = db
      .prepare('SELECT * FROM push_jobs ORDER BY rowid')
      .all() as Record<string, unknown>[];
    expect(migrate(db, MIGRATIONS.slice(0, 17))).toBe(1);
    expect(db.prepare('SELECT * FROM push_jobs ORDER BY rowid').all()).toEqual(
      before.map((row) => ({
        ...row,
        topic: row.kind === 'messages' ? null : row.kind,
      })),
    );
    expect(db.prepare('SELECT * FROM push_off').all()).toEqual([]);
    db.close();
  });

  it('stores each kind once per player and forgets them with the account', () => {
    const db = databaseAt(17);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Anna', 's', 'h', 1);
      INSERT INTO push_off VALUES ('u1', 'news'), ('u1', 'fleet');
    `);
    expect(() => db.exec("INSERT INTO push_off VALUES ('u1', 'news')")).toThrow(
      /UNIQUE constraint failed/,
    );
    expect(() => db.exec("INSERT INTO push_off VALUES ('u2', 'news')")).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    db.exec("DELETE FROM users WHERE id = 'u1'");
    expect(db.prepare('SELECT * FROM push_off').all()).toEqual([]);
    db.close();
  });
});
