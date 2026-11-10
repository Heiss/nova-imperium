import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';

// Migration 7 adds the optional text body to queued push notifications.
describe('upgrade to migration 7', () => {
  it('keeps queued push jobs and gives them no body', () => {
    const db = databaseAt(6);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Anna', 's', 'h', 1);
      INSERT INTO push_subscriptions VALUES ('https://push.example/1', 'u1', 'k', 'a');
      INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at, attempts)
        VALUES ('https://push.example/1', 'fleet', 'f1', 2.5, 3.5, 1);
    `);
    expect(migrate(db, MIGRATIONS.slice(0, 7))).toBe(1);
    expect(db.prepare('SELECT * FROM push_jobs').all()).toEqual([
      {
        endpoint: 'https://push.example/1',
        kind: 'fleet',
        event_key: 'f1',
        due: 2.5,
        retry_at: 3.5,
        attempts: 1,
        body: null,
      },
    ]);
    db.close();
  });
});
