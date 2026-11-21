import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  databaseAt,
  placeOf,
  plansBefore,
  snapshot,
  throughNumber,
  upgrade,
} from '../../../test/migrations.ts';
import { hashPassword } from '../../auth.ts';
import { deleteAccount } from '../../delete-account.ts';
import { MIGRATIONS } from '../schema.ts';
import { runAction } from '../../game/dispatch.ts';
import { GUILD_RIGHTS } from '../../../core/guild-ranks.ts';
import { testCtx } from '../../test-helpers.ts';
import { migrate } from '../database.ts';

// Migration 20 (#169): the guild chat. The CHECK of guild_rank_rights
// takes the three chat rights, every existing rank below the Leitung gets
// „Chat lesen“ and „Chat schreiben“ and only the Leitung deletes (owner,
// 2026-11-15), and the table guild_chat holds the messages and events:
// deleted with their guild, anonymous once the account of their author is
// deleted (owner, D7), deleted at every new round (D6). Every member gets
// `chat_seen` 0, for the red mark on „Gilden“ (owner, 2026-11-15).
type Rows = Record<string, unknown>[];

const sorted = (rows: Rows): string[] =>
  rows.map((r) => JSON.stringify(r)).sort();

const PASSWORD = hashPassword('secret1', 'salt');

/**
 * Version 19 as players left it: Outer Rim with Leitung, an Offizier with
 * rights and Mitglied (its default rank), Xylon whose Leitung chose a rank
 * of its own („Rekrut“) as the default rank, and an applicant.
 */
function oldDatabase() {
  const db = databaseAt(placeOf(20) - 1);
  db.prepare(
    `INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 'salt', ?, 1), ('u_Bert', 'Bert', 'salt', ?, 1),
      ('u_Cora', 'Cora', 'salt', ?, 1), ('u_Dana', 'Dana', 'salt', ?, 1),
      ('u_Emil', 'Emil', 'salt', ?, 1), ('u_Finn', 'Finn', 'salt', ?, 1)`,
  ).run(...Array<string>(6).fill(PASSWORD));
  db.exec(`
    INSERT INTO guilds (id, tag, name, description, founder) VALUES
      ('g1', 'OR', 'Outer Rim', '**Hallo**', 'u_Anna'),
      ('g2', 'XY', 'Xylon', '', 'u_Dana');
    INSERT INTO guild_ranks VALUES
      ('r0_g1', 'g1', 'Leitung', 0), ('ro', 'g1', 'Offizier', 1),
      ('r1_g1', 'g1', 'Mitglied', 2),
      ('r0_g2', 'g2', 'Leitung', 0), ('r1_g2', 'g2', 'Mitglied', 1),
      ('rr', 'g2', 'Rekrut', 2);
    UPDATE guilds SET default_rank = 'r1_g1' WHERE id = 'g1';
    UPDATE guilds SET default_rank = 'rr' WHERE id = 'g2';
    INSERT INTO guild_rank_rights VALUES
      ('ro', 'remove'), ('ro', 'applications'), ('r1_g2', 'profile');
    INSERT INTO guild_members VALUES
      ('u_Anna', 'g1', 'member', 'r0_g1'), ('u_Bert', 'g1', 'member', 'ro'),
      ('u_Cora', 'g1', 'member', 'r1_g1'), ('u_Finn', 'g1', 'pending', NULL),
      ('u_Dana', 'g2', 'member', 'r0_g2'), ('u_Emil', 'g2', 'member', 'rr');
  `);
  return db;
}

const all = (db: ReturnType<typeof databaseAt>, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table}`).all() as Rows;

const rights = (db: ReturnType<typeof databaseAt>) =>
  db
    .prepare(
      'SELECT rank_id, right_key FROM guild_rank_rights ORDER BY rank_id, right_key',
    )
    .all();

/** The rows of guild_members without the new column, which must be 0. */
const membersBefore = (rows: Rows): Rows =>
  rows.map((r) => {
    expect(r.chat_seen).toBe(0);
    const rest = { ...r };
    delete rest.chat_seen;
    return rest;
  });

describe('upgrade to migration 20', () => {
  it('gives every rank below the Leitung reading and writing and keeps every other right and row', () => {
    const db = oldDatabase();
    const kept = Object.fromEntries(
      ['users', 'guilds', 'guild_ranks'].map((t) => [t, all(db, t)]),
    );
    const members = all(db, 'guild_members');
    const before = all(db, 'guild_rank_rights');

    expect(migrate(db, throughNumber(20))).toBe(1);

    for (const [t, rows] of Object.entries(kept))
      expect(sorted(all(db, t)), t).toEqual(sorted(rows));
    expect(sorted(membersBefore(all(db, 'guild_members')))).toEqual(
      sorted(members),
    );
    // Every rank below the Leitung, the default rank or not; the Leitung
    // rows stay empty, as it holds every right anyway; nobody gets
    // „Chatnachrichten löschen“.
    expect(rights(db)).toEqual([
      { rank_id: 'r1_g1', right_key: 'chat-read' },
      { rank_id: 'r1_g1', right_key: 'chat-write' },
      { rank_id: 'r1_g2', right_key: 'chat-read' },
      { rank_id: 'r1_g2', right_key: 'chat-write' },
      { rank_id: 'r1_g2', right_key: 'profile' },
      { rank_id: 'ro', right_key: 'applications' },
      { rank_id: 'ro', right_key: 'chat-read' },
      { rank_id: 'ro', right_key: 'chat-write' },
      { rank_id: 'ro', right_key: 'remove' },
      { rank_id: 'rr', right_key: 'chat-read' },
      { rank_id: 'rr', right_key: 'chat-write' },
    ]);
    // Every right of version 19 is still there.
    expect(sorted(before)).toHaveLength(3);
    for (const row of sorted(before))
      expect(sorted(all(db, 'guild_rank_rights'))).toContain(row);
    expect(all(db, 'guild_chat')).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');

    // Read through the game as it runs: every rank reads and writes, the
    // Offizier keeps its rights, and only the Leitung deletes. The game
    // reads the columns of later migrations (the vacation of #223) and
    // today's actions land the due fleets with the holding time of #55.
    migrate(db, MIGRATIONS);
    const ctx = testCtx(1_000_000, 42, db);
    expect(
      runAction(ctx, 'u_Cora', { type: 'sendGuildChat', text: 'Hi' }),
    ).toBe(null);
    expect(
      runAction(ctx, 'u_Bert', { type: 'sendGuildChat', text: 'Ho' }),
    ).toBe(null);
    expect(
      runAction(ctx, 'u_Emil', { type: 'sendGuildChat', text: 'Yo' }),
    ).toBe(null);
    expect(ctx.guilds.chat('g1').map((m) => [m.author, m.text])).toEqual([
      ['u_Cora', 'Hi'],
      ['u_Bert', 'Ho'],
    ]);
    const [hi, ho] = ctx.guilds.chat('g1').map((m) => m.id);
    for (const who of ['u_Bert', 'u_Cora'])
      expect(() =>
        runAction(ctx, who, { type: 'deleteGuildChat', id: hi }),
      ).toThrow('Dazu fehlt deinem Rang das Recht.');
    expect(runAction(ctx, 'u_Anna', { type: 'deleteGuildChat', id: ho })).toBe(
      'Nachricht gelöscht.',
    );
    expect(ctx.guilds.chat('g2').map((m) => [m.author, m.text])).toEqual([
      ['u_Emil', 'Yo'],
    ]);
    db.close();
  });

  it('allows the eight rights only and limits a message to 1 to 1,000 characters', () => {
    const db = oldDatabase();
    migrate(db, throughNumber(20));
    // „Chat lesen“ and „Chat schreiben“ came with the migration.
    db.exec(`INSERT INTO guild_rank_rights VALUES
      ('ro', 'chat-delete'), ('ro', 'assign'), ('ro', 'profile'),
      ('ro', 'ranks')`);
    expect(
      db
        .prepare("SELECT right_key FROM guild_rank_rights WHERE rank_id = 'ro'")
        .pluck()
        .all()
        .sort(),
    ).toEqual([...GUILD_RIGHTS].sort());
    for (const key of ['chat', 'dissolve', 'Chat-read', 'report'])
      expect(() =>
        db
          .prepare('INSERT INTO guild_rank_rights VALUES (?, ?)')
          .run('r1_g1', key),
      ).toThrow('CHECK constraint failed');
    const add = db.prepare(
      'INSERT INTO guild_chat (guild_id, author, time, text) VALUES (?, ?, ?, ?)',
    );
    for (const text of ['', 'a'.repeat(1001)])
      expect(() => add.run('g1', 'u_Anna', 1, text)).toThrow(
        'CHECK constraint failed',
      );
    add.run('g1', 'u_Anna', 1, 'a'.repeat(1000));
    // 1,000 characters of two code units each.
    add.run('g1', 'u_Anna', 2, '😀'.repeat(1000));
    expect(() => add.run('none', 'u_Anna', 3, 'x')).toThrow(
      'FOREIGN KEY constraint failed',
    );
    expect(() => add.run('g1', 'nobody', 3, 'x')).toThrow(
      'FOREIGN KEY constraint failed',
    );
    expect(() => add.run('g1', 'u_Anna', 1.5, 'x')).toThrow(
      'cannot store REAL value in INTEGER column',
    );
    add.run('g1', null, 3, 'anonym');
    expect(all(db, 'guild_chat')).toHaveLength(3);
    db.close();
  });

  it('keeps the rules of #163 for existing ranks: an Offizier with the right to assign still gives the default rank', () => {
    const db = oldDatabase();
    db.exec(
      "INSERT INTO guild_rank_rights VALUES ('ro', 'assign'), ('ro', 'ranks')",
    );
    migrate(db, throughNumber(20));
    // The game reads the columns of later migrations (the vacation of #223,
    // the holding time of #55).
    migrate(db, MIGRATIONS);
    const ctx = testCtx(1_000_000, 42, db);
    const run = (who: string, d: Record<string, unknown>) =>
      runAction(ctx, who, d);
    // Bert (Offizier) holds the chat rights of Mitglied now, so Mitglied is
    // a rank he may give: back from a rank of his own to the default rank.
    run('u_Anna', { type: 'createGuildRank', name: 'Gast' });
    const guest = ctx.guilds.ranks('g1').find((r) => r.name === 'Gast')!.id;
    expect(
      run('u_Bert', { type: 'assignGuildRank', uid: 'u_Cora', rank: guest }),
    ).toBe('Rang vergeben.');
    expect(
      run('u_Bert', { type: 'assignGuildRank', uid: 'u_Cora', rank: 'r1_g1' }),
    ).toBe('Rang vergeben.');
    // He deletes a rank with members: they move to the default rank.
    run('u_Bert', { type: 'assignGuildRank', uid: 'u_Cora', rank: guest });
    expect(run('u_Bert', { type: 'deleteGuildRank', rank: guest })).toBe(
      'Rang gelöscht.',
    );
    expect(ctx.guilds.membership('u_Cora')!.rank_id).toBe('r1_g1');
    // What is left: a rank made later starts without rights, so a holder
    // with „Ränge an Mitglieder vergeben“ lacks the chat rights of Mitglied.
    run('u_Anna', { type: 'createGuildRank', name: 'Neu' });
    const fresh = ctx.guilds.ranks('g1').find((r) => r.name === 'Neu')!;
    while (ctx.guilds.rank(fresh.id)!.position > 1)
      run('u_Anna', { type: 'moveGuildRank', rank: fresh.id, up: true });
    run('u_Anna', {
      type: 'setGuildRankRights',
      rank: fresh.id,
      rights: ['assign'],
    });
    run('u_Anna', { type: 'assignGuildRank', uid: 'u_Bert', rank: fresh.id });
    run('u_Anna', { type: 'assignGuildRank', uid: 'u_Cora', rank: 'ro' });
    expect(ctx.guilds.ranks('g1').map((r) => r.name)).toEqual([
      'Leitung',
      'Neu',
      'Offizier',
      'Mitglied',
    ]);
    expect(() =>
      run('u_Bert', { type: 'assignGuildRank', uid: 'u_Cora', rank: 'r1_g1' }),
    ).toThrow('Dazu fehlt deinem Rang das Recht.');
    db.close();
  });

  it('deletes the chat with its guild and anonymises the messages of a deleted account', () => {
    const db = oldDatabase();
    migrate(db, throughNumber(20));
    const ctx = testCtx(1_000_000, 42, db);
    ctx.guilds.addChat('g1', 'u_Cora', 1, 'von Cora');
    ctx.guilds.addChat('g1', 'u_Anna', 2, 'von Anna');
    ctx.guilds.addChat('g2', 'u_Emil', 3, 'von Emil');
    ctx.guilds.addChat('g2', 'u_Dana', 4, 'von Dana');

    // Cora deletes her account: her message stays without its author.
    deleteAccount(ctx, ctx.players.get('u_Cora')!, 'secret1');
    expect(
      db
        .prepare('SELECT guild_id, author, text FROM guild_chat ORDER BY id')
        .all(),
    ).toEqual([
      { guild_id: 'g1', author: null, text: 'von Cora' },
      { guild_id: 'g1', author: 'u_Anna', text: 'von Anna' },
      { guild_id: 'g2', author: 'u_Emil', text: 'von Emil' },
      { guild_id: 'g2', author: 'u_Dana', text: 'von Dana' },
    ]);
    // Dana's deletion dissolves the guild she leads, with its chat.
    deleteAccount(ctx, ctx.players.get('u_Dana')!, 'secret1');
    expect(
      db
        .prepare('SELECT guild_id, author, text FROM guild_chat ORDER BY id')
        .all(),
    ).toEqual([
      { guild_id: 'g1', author: null, text: 'von Cora' },
      { guild_id: 'g1', author: 'u_Anna', text: 'von Anna' },
    ]);
    // The guild itself, deleted.
    db.exec("DELETE FROM guilds WHERE id = 'g1'");
    expect(all(db, 'guild_chat')).toEqual([]);
    expect(all(db, 'guild_rank_rights')).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('deletes every chat at a new round and keeps the guilds', () => {
    const db = oldDatabase();
    migrate(db, throughNumber(20));
    // The new round of today's code saves the players with the columns of
    // later migrations (the main planet of #221).
    migrate(db, MIGRATIONS);
    db.exec("UPDATE users SET admin = 1 WHERE id = 'u_Finn'");
    const ctx = testCtx(1_000_000, 42, db);
    ctx.guilds.addChat('g1', 'u_Cora', 1, 'alte Runde');
    ctx.guilds.addChat('g2', 'u_Emil', 2, 'alte Runde');
    runAction(ctx, 'u_Finn', { type: 'reset', guilds: true });
    expect(all(db, 'guild_chat')).toEqual([]);
    expect(
      ctx.guilds
        .all()
        .map((g) => g.id)
        .sort(),
    ).toEqual(['g1', 'g2']);
    db.close();
  });

  it('keeps all data of any valid database of version 19 and adds only the chat rights of the ranks below the Leitung', () => {
    fc.assert(
      fc.property(plansBefore(placeOf(20)), (plan) => {
        const { before, after, foreignKeys, integrity } = upgrade(
          placeOf(20),
          plan,
        );
        expect(foreignKeys).toEqual([]);
        expect(integrity).toBe('ok');
        const rows = (s: ReturnType<typeof snapshot>, t: string): Rows =>
          JSON.parse(s.data.get(t)!) as Rows;
        for (const t of before.data.keys())
          if (t !== 'guild_rank_rights' && t !== 'guild_members')
            expect(sorted(rows(after, t)), t).toEqual(sorted(rows(before, t)));
        expect(sorted(membersBefore(rows(after, 'guild_members')))).toEqual(
          sorted(rows(before, 'guild_members')),
        );
        const below = rows(before, 'guild_ranks')
          .filter((r) => (r.position as number) > 0)
          .map((r) => r.id);
        const had = new Set(sorted(rows(before, 'guild_rank_rights')));
        const added = below
          .flatMap((rank) =>
            ['chat-read', 'chat-write'].map((key) => ({
              rank_id: rank,
              right_key: key,
            })),
          )
          .filter((r) => !had.has(JSON.stringify(r)));
        expect(sorted(rows(after, 'guild_rank_rights'))).toEqual(
          sorted([...rows(before, 'guild_rank_rights'), ...added]),
        );
        expect(rows(after, 'guild_chat')).toEqual([]);
      }),
      { numRuns: 50, seed: 169 },
    );
  });
});
