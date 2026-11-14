import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  databaseAt,
  plansBefore,
  snapshot,
  upgrade,
} from '../../../test/migrations.ts';
import { testCtx } from '../../test-helpers.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';

// Migration 16 (#163): guild ranks with rights. Every guild gets the ranks
// Leitung (held by the founder) and Mitglied (the default rank); every other
// member gets Mitglied, an applicant no rank.
type Rows = Record<string, unknown>[];

const sorted = (rows: Rows): string[] =>
  rows.map((r) => JSON.stringify(r)).sort();

const without = (rows: Rows, column: string): Rows =>
  rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => k !== column)),
  );

function oldDatabase() {
  const db = databaseAt(15);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 1),
      ('u_Cora', 'Cora', 's', 'h', 1), ('u_Dana', 'Dana', 's', 'h', 1),
      ('u_Emil', 'Emil', 's', 'h', 1), ('u_Finn', 'Finn', 's', 'h', 1);
    INSERT INTO guilds VALUES
      ('g1', 'OR', 'Outer Rim', '**Hallo**', 'u_Anna'),
      ('g2', 'XY', 'Xylon', '', 'u_Dana');
    INSERT INTO guild_members VALUES
      ('u_Anna', 'g1', 'member'), ('u_Bert', 'g1', 'member'),
      ('u_Cora', 'g1', 'pending'), ('u_Dana', 'g2', 'member'),
      ('u_Emil', 'g2', 'member');
  `);
  return db;
}

const all = (db: ReturnType<typeof databaseAt>, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table}`).all() as Rows;

/** Every guild has Leitung and Mitglied, and Mitglied is its default rank. */
function checkRanks(guilds: Rows, ranks: Rows): void {
  for (const g of guilds) {
    const own = ranks.filter((r) => r.guild_id === g.id);
    expect(own.map((r) => [r.position, r.name]).sort()).toEqual([
      [0, 'Leitung'],
      [1, 'Mitglied'],
    ]);
    expect(g.default_rank).toBe(own.find((r) => r.position === 1)!.id);
  }
}

/** The founder holds the Leitung, every other member Mitglied, an applicant none. */
function checkMembers(members: Rows, guilds: Rows, ranks: Rows): void {
  for (const m of members) {
    const rank = ranks.find((r) => r.id === m.rank_id);
    const founder = guilds.find((g) => g.id === m.guild_id)!.founder;
    if (m.status === 'pending') expect(m.rank_id).toBeNull();
    else
      expect([rank?.guild_id, rank?.position]).toEqual([
        m.guild_id,
        m.user_id === founder ? 0 : 1,
      ]);
  }
}

describe('upgrade to migration 16', () => {
  it('gives every guild the ranks Leitung and Mitglied and keeps its data', () => {
    const db = oldDatabase();
    const guilds = all(db, 'guilds');
    const members = all(db, 'guild_members');
    const users = all(db, 'users');

    expect(migrate(db, MIGRATIONS.slice(0, 16))).toBe(1);

    expect(sorted(without(all(db, 'guilds'), 'default_rank'))).toEqual(
      sorted(guilds),
    );
    expect(sorted(without(all(db, 'guild_members'), 'rank_id'))).toEqual(
      sorted(members),
    );
    expect(all(db, 'users')).toEqual(users);
    expect(
      db
        .prepare(
          'SELECT guild_id, position, name FROM guild_ranks ORDER BY guild_id, position',
        )
        .all(),
    ).toEqual([
      { guild_id: 'g1', position: 0, name: 'Leitung' },
      { guild_id: 'g1', position: 1, name: 'Mitglied' },
      { guild_id: 'g2', position: 0, name: 'Leitung' },
      { guild_id: 'g2', position: 1, name: 'Mitglied' },
    ]);
    expect(all(db, 'guild_rank_rights')).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');

    // Read through the repository as the game does.
    const ctx = testCtx(1_000_000, 42, db);
    expect(ctx.guilds.get('g1')?.founder).toBe('u_Anna');
    const [lead, member] = ctx.guilds.ranks('g1');
    expect(lead).toMatchObject({ name: 'Leitung', position: 0, rights: [] });
    expect(member).toMatchObject({ name: 'Mitglied', position: 1, rights: [] });
    expect(ctx.guilds.get('g1')?.default_rank).toBe(member!.id);
    const rankOf = (uid: string) => ctx.guilds.membership(uid)?.rank_id;
    expect(rankOf('u_Anna')).toBe(lead!.id);
    expect(rankOf('u_Bert')).toBe(member!.id);
    expect(rankOf('u_Cora')).toBeNull();
    const [lead2, member2] = ctx.guilds.ranks('g2');
    expect(rankOf('u_Dana')).toBe(lead2!.id);
    expect(rankOf('u_Emil')).toBe(member2!.id);
    expect(ctx.guilds.get('g2')?.default_rank).toBe(member2!.id);
    expect(ctx.guilds.membership('u_Finn')).toBeUndefined();
    db.close();
  });

  it('lets the old applicant join with the default rank after the upgrade', () => {
    const db = oldDatabase();
    migrate(db, MIGRATIONS.slice(0, 16));
    const ctx = testCtx(1_000_000, 42, db);
    ctx.guilds.accept('u_Cora');
    expect(ctx.guilds.membership('u_Cora')).toEqual({
      user_id: 'u_Cora',
      guild_id: 'g1',
      status: 'member',
      rank_id: ctx.guilds.ranks('g1')[1]!.id,
    });
    db.close();
  });

  it('allows only the known rights, one place per rank, and cascades with the guild', () => {
    const db = oldDatabase();
    migrate(db, MIGRATIONS.slice(0, 16));
    const [lead, member] = db
      .prepare(
        "SELECT id FROM guild_ranks WHERE guild_id = 'g1' ORDER BY position",
      )
      .pluck()
      .all() as string[];
    db.prepare(
      "INSERT INTO guild_rank_rights VALUES (?, 'applications'), (?, 'ranks')",
    ).run(member, member);
    expect(() =>
      db
        .prepare("INSERT INTO guild_rank_rights VALUES (?, 'dissolve')")
        .run(member),
    ).toThrow('CHECK constraint failed');
    expect(() =>
      db
        .prepare("INSERT INTO guild_ranks VALUES ('rx', 'g1', 'Doppelt', 1)")
        .run(),
    ).toThrow('UNIQUE constraint failed');
    // A rank that members hold cannot just disappear.
    expect(() =>
      db.prepare('DELETE FROM guild_ranks WHERE id = ?').run(lead),
    ).toThrow('FOREIGN KEY constraint failed');
    db.exec("DELETE FROM guilds WHERE id = 'g1'");
    expect(
      db.prepare('SELECT DISTINCT guild_id FROM guild_ranks').pluck().all(),
    ).toEqual(['g2']);
    expect(all(db, 'guild_rank_rights')).toEqual([]);
    expect(
      db.prepare('SELECT user_id FROM guild_members ORDER BY 1').pluck().all(),
    ).toEqual(['u_Dana', 'u_Emil']);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('keeps all data of any valid database of version 15', () => {
    fc.assert(
      fc.property(plansBefore(16), (plan) => {
        const { before, after, foreignKeys } = upgrade(16, plan);
        expect(foreignKeys).toEqual([]);
        const rows = (s: ReturnType<typeof snapshot>, t: string): Rows =>
          JSON.parse(s.data.get(t)!) as Rows;
        const added: Record<string, string> = {
          guilds: 'default_rank',
          guild_members: 'rank_id',
        };
        for (const t of before.data.keys()) {
          const now = rows(after, t);
          const kept = added[t] ? without(now, added[t]) : now;
          expect(sorted(kept), t).toEqual(sorted(rows(before, t)));
        }
        const ranks = rows(after, 'guild_ranks');
        expect(ranks).toHaveLength(2 * rows(before, 'guilds').length);
        checkRanks(rows(after, 'guilds'), ranks);
        checkMembers(
          rows(after, 'guild_members'),
          rows(after, 'guilds'),
          ranks,
        );
        expect(rows(after, 'guild_rank_rights')).toEqual([]);
      }),
      { numRuns: 50, seed: 163 },
    );
  });
});
