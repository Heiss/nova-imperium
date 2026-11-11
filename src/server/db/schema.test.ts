import { describe, expect, it } from 'vitest';
import { openDatabase } from './database.ts';

// The schema after all migrations, as SQLite stores it. A pull request that
// adds a migration also updates schema.snapshot.sql (pnpm test -u), so the
// review shows the resulting schema and not only the migration.
describe('schema', () => {
  it('matches the committed snapshot after all migrations', async () => {
    const db = openDatabase(':memory:');
    const rows = db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`,
      )
      .pluck()
      .all() as string[];
    db.close();
    await expect(rows.map((sql) => `${sql};\n`).join('\n')).toMatchFileSnapshot(
      './schema.snapshot.sql',
    );
  });
});
