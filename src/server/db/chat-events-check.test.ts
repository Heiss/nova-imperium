// The events of the guild chat (#426 part 6) against the CHECK of the
// database (owner, 2026-11-26, 192a): the kinds are generated from the files
// of src/core/chat-events, the CHECK of `guild_chat.kind` is written by a
// migration, and migrations are append-only. A kind added to one but not to
// the other fails here.
import { describe, expect, it } from 'vitest';
import { CHAT_EVENTS } from '../../core/guild-chat.ts';
import { openDatabase } from './database.ts';

/**
 * The values of the CHECK on the column `kind` itself (`kind TEXT … CHECK
 * (kind IN (…))`), not those of the other CHECKs that name kinds.
 */
function checkedKinds(create: string): string[] {
  const list =
    /\bkind\s+TEXT\b[^,]*?CHECK\s*\(\s*kind\s+IN\s*\(([^)]*)\)/i.exec(
      create,
    )?.[1];
  if (list === undefined) throw new Error('no CHECK on the column kind');
  return [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
}

describe('the chat events and the CHECK of the database (#426, 192a)', () => {
  it('reads the CHECK of the column, not another CHECK that names kinds', () => {
    expect(
      checkedKinds(
        "CREATE TABLE t (kind TEXT NOT NULL DEFAULT 'message'\n CHECK (kind IN ('message', 'a',\n 'b')),\n text TEXT CHECK (length(text) > 0 OR (kind IN ('a') AND text = '')))",
      ),
    ).toEqual(['message', 'a', 'b']);
    expect(() => checkedKinds('CREATE TABLE t (x TEXT)')).toThrow(
      'no CHECK on the column kind',
    );
  });

  it('allows exactly the messages and the events of the generated list', () => {
    const db = openDatabase(':memory:');
    try {
      const create = db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'guild_chat'",
        )
        .pluck()
        .get() as string;
      const checked = checkedKinds(create);
      const kinds = ['message', ...CHAT_EVENTS];
      expect(
        [...checked].sort(),
        `The CHECK of guild_chat.kind (${checked.join(', ')}) and the kinds message and CHAT_EVENTS (${kinds.join(', ')}) differ: a new or removed event needs a new migration that rewrites the CHECK (migrations are append-only).`,
      ).toEqual([...kinds].sort());
    } finally {
      db.close();
    }
  });
});
