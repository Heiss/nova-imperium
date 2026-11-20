// What a new round clears and what it keeps (#317, owner, 2026-11-20): a test
// of the behaviour of `reset`, not a list a feature edits. Every table of the
// schema gets a marked row (found again by its rowid); after the reset the
// row is gone or it is not. A table a feature adds is seeded and checked
// without a line here: it has to be cleared or kept on purpose.
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import type { Db } from '../db/database.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { clearsOf, keptBy } from '../db/round-reset.ts';
import { ROUND_RESETS } from '../round-reset.gen.ts';
import { reset } from './admin.ts';

/** The rowid of the marked row of every table. */
const MARK = 424242;

interface Column {
  name: string;
  type: string;
  notnull: number;
  pk: number;
  hidden: number;
}
interface Link {
  table: string;
  from: string;
  to: string | null;
}

/** The tables of the schema the app owns (not the engine's own, not the migration history). */
const tablesOf = (db: Db): string[] =>
  (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY name",
      )
      .pluck()
      .all() as string[]
  ).filter((name) => name !== 'users');

type Seeded = Map<string, Map<string, unknown>>;

const linksOf = (db: Db, table: string): Link[] =>
  db.pragma(`foreign_key_list(${table})`) as Link[];
const columnsOf = (db: Db, table: string): Column[] =>
  (db.pragma(`table_xinfo(${table})`) as Column[]).filter(
    (c) => c.hidden === 0,
  );

/** Whether every parent of a required link is a player, the table itself or seeded. */
const parentsReady = (db: Db, table: string, seeded: Seeded): boolean => {
  const columns = columnsOf(db, table);
  return linksOf(db, table).every(
    (l) =>
      l.table === 'users' ||
      l.table === table ||
      !columns.find((c) => c.name === l.from)!.notnull ||
      seeded.has(l.table),
  );
};

/** The value of a column of the marked row, by its link or its type. */
function valueOf(
  table: string,
  column: Column,
  link: Link | undefined,
  seeded: Seeded,
  player: string,
): unknown {
  if (link?.table === 'users') return player;
  if (link) return seeded.get(link.table)?.get(link.to ?? 'id') ?? null;
  const type = column.type.toUpperCase();
  if (type === 'TEXT') return `m_${table}_${column.name}`;
  if (type === 'REAL') return 1.5;
  if (type === 'BLOB') return Buffer.from([0]);
  return MARK;
}

/** Writes the marked row of a table and returns its values by column. */
function seedTable(
  db: Db,
  table: string,
  seeded: Seeded,
  player: string,
): Map<string, unknown> {
  const columns = columnsOf(db, table);
  const links = linksOf(db, table);
  const row = new Map(
    columns.map((c) => [
      c.name,
      valueOf(
        table,
        c,
        links.find((l) => l.from === c.name),
        seeded,
        player,
      ),
    ]),
  );
  // A single INTEGER key is the rowid itself; any other table gets its rowid set.
  const keys = columns.filter((c) => c.pk > 0);
  const alias = keys.length === 1 && keys[0]?.type.toUpperCase() === 'INTEGER';
  const names = [...(alias ? [] : ['rowid']), ...row.keys()];
  const values = [...(alias ? [] : [MARK]), ...row.values()];
  db.prepare(
    `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
  ).run(...values);
  return row;
}

/**
 * One marked row in every table but `users` (the real players are the
 * parents): text, numbers and blobs by the type of the column; a link to a
 * parent row names the marked row of the parent, a link to a player the first
 * player. Checks are off while the rows are written.
 */
function seedMarkers(db: Db, player: string): void {
  db.pragma('foreign_keys = OFF');
  db.pragma('ignore_check_constraints = ON');
  const seeded: Seeded = new Map();
  const pending = new Set(tablesOf(db));
  while (pending.size) {
    const table = [...pending].find((t) => parentsReady(db, t, seeded));
    if (!table)
      throw new Error(`Foreign keys of ${[...pending]} run in a ring.`);
    pending.delete(table);
    seeded.set(table, seedTable(db, table, seeded, player));
  }
  db.pragma('ignore_check_constraints = OFF');
  db.pragma('foreign_keys = ON');
}

/** The tables whose marked row is still there. */
const survivors = (db: Db): string[] =>
  tablesOf(db).filter(
    (table) =>
      db.prepare(`SELECT 1 FROM ${table} WHERE rowid = ?`).get(MARK) !==
      undefined,
  );

/** Two players with a planet, one of them in vacation, a marked row everywhere. */
function world(): { ctx: TestCtx; admin: ReturnType<typeof addUser> } {
  const ctx = testCtx();
  const admin = addUser(ctx, 'Anna', { admin: true });
  const bob = addUser(ctx, 'Bob', { vacation: 5 });
  addPlanet(ctx, admin.id);
  addPlanet(ctx, bob.id, { s: 2 });
  seedMarkers(ctx.db, admin.id);
  return { ctx, admin };
}

/** The tables `DELETE FROM x` empties during `run`, in order; a DELETE with a WHERE (one player, one planet) is left out. */
function deletes(db: Db, run: () => void): string[] {
  const seen: string[] = [];
  const note = (sql: string) => {
    for (const part of sql.split(';')) {
      const m = /^\s*DELETE FROM (\w+)\s*$/i.exec(part);
      if (m?.[1]) seen.push(m[1]);
    }
  };
  const prepare = db.prepare.bind(db);
  const exec = db.exec.bind(db);
  db.prepare = ((sql: string) => (note(sql), prepare(sql))) as Db['prepare'];
  db.exec = ((sql: string) => (note(sql), exec(sql))) as Db['exec'];
  try {
    run();
  } finally {
    // Back to the methods of the class.
    delete (db as Partial<Db>).prepare;
    delete (db as Partial<Db>).exec;
  }
  return seen;
}

const rulesOf = (guilds: boolean) => ({ guilds }) as RoundRules;

/** The tables the declarations of the modules keep in a round; the players are the parents of the seed and not seeded. */
const declaredKept = (guilds: boolean): string[] =>
  keptBy(ROUND_RESETS, rulesOf(guilds)).filter((t) => t !== 'users');

/** The tables the declarations empty with `DELETE FROM`, in the order of their numbers. */
const declaredCleared = (guilds: boolean): string[] =>
  clearsOf(ROUND_RESETS)
    .filter((step) => step.when?.(rulesOf(guilds)) ?? true)
    .flatMap((step) => [...step.clears]);

describe('what a new round clears (#317)', () => {
  // The tables a new round left, and the order of its DELETE statements, were
  // written out before the DELETE lines moved to the modules and passed
  // unchanged after it; now the modules' declarations are checked against the
  // schema, so a new table needs no line here.
  it('keeps what the modules declare as kept and clears every other table of the schema', () => {
    const { ctx, admin } = world();
    reset(ctx, admin, {});
    expect(survivors(ctx.db)).toEqual(declaredKept(true));
    // The players stay, with fresh research, no main planet and no vacation.
    expect(ctx.players.all().map((u) => u.id)).toEqual(['u_Anna', 'u_Bob']);
    expect(ctx.players.get('u_Bob')!.vacation).toBeNull();
  });

  it('keeps the accounts, the settings and the round archive of every round', () => {
    const { ctx, admin } = world();
    reset(ctx, admin, {});
    for (const table of ['sessions', 'settings', 'rounds', 'friendships'])
      expect(survivors(ctx.db), table).toContain(table);
  });

  it('clears the reports of a player before the notice of his vacation', () => {
    const { ctx, admin } = world();
    reset(ctx, admin, {});
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    expect(ctx.reports.ofPlayer('u_Bob')).toHaveLength(1);
  });

  it('clears the guilds too when the round starts with guilds off (#191)', () => {
    const { ctx, admin } = world();
    reset(ctx, admin, { guilds: false });
    expect(survivors(ctx.db)).toEqual(declaredKept(false));
    expect(survivors(ctx.db)).not.toContain('guilds');
  });

  it('empties the declared tables in the order of the numbers', () => {
    const { ctx, admin } = world();
    expect(deletes(ctx.db, () => reset(ctx, admin, {}))).toEqual(
      declaredCleared(true),
    );
    const off = world();
    expect(
      deletes(off.ctx.db, () => reset(off.ctx, off.admin, { guilds: false })),
    ).toEqual(declaredCleared(false));
  });

  it('empties the guilds before their chats when the guilds are off', () => {
    const { ctx, admin } = world();
    const order = deletes(ctx.db, () => reset(ctx, admin, { guilds: false }));
    expect(order.indexOf('guilds')).toBeGreaterThan(-1);
    expect(order.indexOf('guilds')).toBeLessThan(order.indexOf('guild_chat'));
  });
});
