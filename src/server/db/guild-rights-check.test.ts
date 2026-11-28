// The rights of the guild ranks (#426 part 5) against the CHECK of the
// database (owner, 2026-11-26, 192a): the list is generated from the files of
// src/core/guild-rights, the CHECK of `guild_rank_rights.right_key` is written
// by a migration, and migrations are append-only. A right added to one but
// not to the other fails here.
import { describe, expect, it } from 'vitest';
import { GUILD_RIGHTS } from '../../core/guild-ranks.ts';
import { openDatabase } from './database.ts';

/** The values of the CHECK `right_key IN (…)` in a CREATE TABLE statement. */
function checkedRights(create: string): string[] {
  const list = /right_key\s+IN\s*\(([^)]*)\)/i.exec(create)?.[1];
  if (list === undefined) throw new Error('no CHECK of right_key');
  return [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
}

describe('the guild rights and the CHECK of the database (#426, 192a)', () => {
  it('reads the values of the CHECK', () => {
    expect(
      checkedRights(
        "CREATE TABLE t (right_key TEXT CHECK (right_key IN ('a', 'b-c',\n 'd')))",
      ),
    ).toEqual(['a', 'b-c', 'd']);
    expect(() => checkedRights('CREATE TABLE t (x TEXT)')).toThrow(
      'no CHECK of right_key',
    );
  });

  it('allows exactly the rights of the generated list', () => {
    const db = openDatabase(':memory:');
    try {
      const create = db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'guild_rank_rights'",
        )
        .pluck()
        .get() as string;
      const checked = checkedRights(create);
      expect(
        [...checked].sort(),
        `The CHECK of guild_rank_rights.right_key (${checked.join(', ')}) and GUILD_RIGHTS (${GUILD_RIGHTS.join(', ')}) differ: a new or removed right needs a new migration that rewrites the CHECK (migrations are append-only).`,
      ).toEqual([...GUILD_RIGHTS].sort());
    } finally {
      db.close();
    }
  });
});
