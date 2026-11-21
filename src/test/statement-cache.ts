// Keeps the prepared statements of a test database by their SQL text.
import type { Db } from '../server/db/database.ts';

/**
 * Keeps the prepared statements of a database by their SQL text for as long
 * as it is `on`: the code under test prepares its statements per call, and
 * `better-sqlite3` would compile the same text again and again (about half of
 * the time of a route test). A statement is shared by its text, so the calls
 * that change one (`pluck`, `raw`, `expand`, `safeIntegers`, `bind`) answer a
 * statement of their own. A test that measures what the production code
 * costs turns it `off` while it measures.
 */
export interface StatementCache {
  on(): void;
  off(): void;
}

const CHANGING = ['pluck', 'raw', 'expand', 'safeIntegers', 'bind'] as const;

export function statementCache(db: Db): StatementCache {
  const kept = new Map<string, unknown>();
  const real = Object.getPrototypeOf(db).prepare as (sql: string) => unknown;
  const set = (prepare: unknown): void => {
    (db as { prepare: unknown }).prepare = prepare;
  };
  const cached = (sql: string): unknown => {
    // A closed database answers with its own error.
    if (!db.open) return real.call(db, sql);
    let statement = kept.get(sql);
    if (!statement) {
      const made = real.call(db, sql) as Record<string, unknown>;
      for (const method of CHANGING)
        made[method] = (...args: unknown[]) =>
          (
            (real.call(db, sql) as Record<string, unknown>)[method] as (
              ...a: unknown[]
            ) => unknown
          )(...args);
      kept.set(sql, (statement = made));
    }
    return statement;
  };
  return { on: () => set(cached), off: () => set(real) };
}
