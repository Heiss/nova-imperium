import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

const setup = () => {
  const ctx = testCtx();
  for (const name of ['Anna', 'Bert', 'Cora']) addUser(ctx, name);
  ctx.guilds.create('g1', 'ABC', 'Alpha', 'Text', 'u_Anna');
  return ctx;
};

describe('guilds repository', () => {
  it('founds a guild with its founder as the first member', () => {
    const ctx = setup();
    expect(ctx.guilds.get('g1')).toEqual({
      id: 'g1',
      tag: 'ABC',
      name: 'Alpha',
      description: 'Text',
      founder: 'u_Anna',
      default_rank: 'r1_g1',
    });
    expect(ctx.guilds.get('none')).toBeUndefined();
    expect(ctx.guilds.membership('u_Anna')).toEqual({
      user_id: 'u_Anna',
      guild_id: 'g1',
      status: 'member',
      rank_id: 'r0_g1',
    });
    expect(ctx.guilds.membership('u_Bert')).toBeUndefined();
  });

  it('finds a tag or name taken by another guild', () => {
    const ctx = setup();
    expect(ctx.guilds.taken('', 'abc', 'Other')).toBe(true);
    expect(ctx.guilds.taken('', 'XYZ', 'alpha')).toBe(true);
    expect(ctx.guilds.taken('', 'XYZ', 'Other')).toBe(false);
    expect(ctx.guilds.taken('g1', 'ABC', 'Alpha')).toBe(false);
  });

  it('updates the profile and hands over the lead', () => {
    const ctx = setup();
    ctx.guilds.update('g1', 'NEW', 'Beta', 'More');
    ctx.guilds.transfer('g1', 'u_Bert', 'r1_g1');
    expect(ctx.guilds.get('g1')).toEqual({
      id: 'g1',
      tag: 'NEW',
      name: 'Beta',
      description: 'More',
      founder: 'u_Bert',
      default_rank: 'r1_g1',
    });
  });

  it('takes applications, accepts and removes members', () => {
    const ctx = setup();
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.apply('u_Cora', 'g1');
    expect(ctx.guilds.membership('u_Bert')?.status).toBe('pending');
    expect(ctx.guilds.hasOtherMembers('g1', 'u_Anna')).toBe(false);
    ctx.guilds.accept('u_Bert');
    expect(ctx.guilds.membership('u_Bert')?.status).toBe('member');
    expect(ctx.guilds.membership('u_Cora')?.status).toBe('pending');
    expect(ctx.guilds.hasOtherMembers('g1', 'u_Anna')).toBe(true);
    expect(ctx.guilds.hasOtherMembers('g1', 'u_Bert')).toBe(true);
    expect(ctx.guilds.hasOtherMembers('g2', 'u_Anna')).toBe(false);
    ctx.guilds.removeMember('u_Bert');
    expect(ctx.guilds.membership('u_Bert')).toBeUndefined();
    expect(ctx.guilds.membership('u_Cora')?.status).toBe('pending');
  });

  it('lists all guilds and their players, and deletes a guild', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.apply('u_Cora', 'g2');
    expect(ctx.guilds.all().map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(
      ctx.guilds.players().sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
      {
        id: 'u_Anna',
        name: 'Anna',
        guild_id: 'g1',
        status: 'member',
        rank_id: 'r0_g1',
      },
      {
        id: 'u_Bert',
        name: 'Bert',
        guild_id: 'g2',
        status: 'member',
        rank_id: 'r0_g2',
      },
      {
        id: 'u_Cora',
        name: 'Cora',
        guild_id: 'g2',
        status: 'pending',
        rank_id: null,
      },
    ]);
    ctx.guilds.delete('g2');
    expect(ctx.guilds.all().map((g) => g.id)).toEqual(['g1']);
    expect(ctx.guilds.membership('u_Cora')).toBeUndefined();
  });
});

describe('guild ranks repository (#163)', () => {
  const ranks = (ctx: ReturnType<typeof setup>) =>
    ctx.guilds.ranks('g1').map((r) => [r.name, r.position, r.rights]);

  it('founds a guild with the ranks Leitung and Mitglied', () => {
    const ctx = setup();
    expect(ctx.guilds.ranks('g1')).toEqual([
      {
        id: 'r0_g1',
        guild_id: 'g1',
        name: 'Leitung',
        position: 0,
        rights: [],
      },
      {
        id: 'r1_g1',
        guild_id: 'g1',
        name: 'Mitglied',
        position: 1,
        // The first default rank reads and writes in the chat (#169, D2).
        rights: ['chat-read', 'chat-write'],
      },
    ]);
    expect(ctx.guilds.ranks('none')).toEqual([]);
    expect(ctx.guilds.rank('r1_g1')?.name).toBe('Mitglied');
    expect(ctx.guilds.rank('none')).toBeUndefined();
  });

  it('adds ranks at the bottom, renames them and stores their rights in order', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.addRank('ra', 'g1', 'Offizier');
    ctx.guilds.addRank('rb', 'g1', 'Rekrut');
    ctx.guilds.renameRank('ra', 'Hauptmann');
    ctx.guilds.setRights('ra', ['ranks', 'applications', 'ranks']);
    ctx.guilds.setRights('rb', ['remove']);
    expect(ranks(ctx)).toEqual([
      ['Leitung', 0, []],
      ['Mitglied', 1, ['chat-read', 'chat-write']],
      ['Hauptmann', 2, ['applications', 'ranks']],
      ['Rekrut', 3, ['remove']],
    ]);
    expect(ctx.guilds.rank('ra')?.rights).toEqual(['applications', 'ranks']);
    // In the order of GUILD_RIGHTS, not as stored or by the alphabet.
    ctx.guilds.setRights('ra', ['ranks', 'profile', 'assign', 'remove']);
    expect(ctx.guilds.rank('ra')?.rights).toEqual([
      'remove',
      'assign',
      'profile',
      'ranks',
    ]);
    expect(ctx.guilds.ranks('g1')[2]!.rights).toEqual([
      'remove',
      'assign',
      'profile',
      'ranks',
    ]);
    ctx.guilds.setRights('ra', []);
    expect(ctx.guilds.rank('ra')?.rights).toEqual([]);
    expect(ctx.guilds.rank('rb')?.rights).toEqual(['remove']);
    // The other guild is untouched.
    expect(ctx.guilds.ranks('g2').map((r) => r.name)).toEqual([
      'Leitung',
      'Mitglied',
    ]);
  });

  it('swaps two ranks and keeps the gaps a deletion leaves', () => {
    const ctx = setup();
    ctx.guilds.addRank('ra', 'g1', 'A');
    ctx.guilds.addRank('rb', 'g1', 'B');
    const [, member, a, b] = ctx.guilds.ranks('g1');
    ctx.guilds.swapRanks(member!, b!);
    expect(ranks(ctx).map(([n, p]) => [n, p])).toEqual([
      ['Leitung', 0],
      ['B', 1],
      ['A', 2],
      ['Mitglied', 3],
    ]);
    ctx.guilds.deleteRank(a!.id, 'r1_g1');
    ctx.guilds.addRank('rc', 'g1', 'C');
    expect(ranks(ctx).map(([n, p]) => [n, p])).toEqual([
      ['Leitung', 0],
      ['B', 1],
      ['Mitglied', 3],
      ['C', 4],
    ]);
  });

  it('gives an accepted member the default rank and moves members of a deleted rank to it', () => {
    const ctx = setup();
    ctx.guilds.addRank('ra', 'g1', 'Offizier');
    ctx.guilds.setRights('ra', ['applications']);
    ctx.guilds.setDefaultRank('g1', 'ra');
    expect(ctx.guilds.get('g1')?.default_rank).toBe('ra');
    ctx.guilds.apply('u_Bert', 'g1');
    expect(ctx.guilds.membership('u_Bert')?.rank_id).toBeNull();
    ctx.guilds.accept('u_Bert');
    expect(ctx.guilds.membership('u_Bert')?.rank_id).toBe('ra');
    ctx.guilds.apply('u_Cora', 'g1');
    ctx.guilds.accept('u_Cora');
    expect(ctx.guilds.rankHasMembers('r1_g1')).toBe(false);
    ctx.guilds.setRank('u_Cora', 'r1_g1');
    expect(ctx.guilds.membership('u_Cora')?.rank_id).toBe('r1_g1');
    expect(ctx.guilds.rankHasMembers('r1_g1')).toBe(true);
    expect(ctx.guilds.rankHasMembers('ra')).toBe(true);
    expect(ctx.guilds.rankHasMembers('none')).toBe(false);
    // The database refuses to delete the default rank.
    expect(() => ctx.guilds.deleteRank('ra', 'r1_g1')).toThrow(
      'FOREIGN KEY constraint failed',
    );
    ctx.guilds.setDefaultRank('g1', 'r1_g1');
    ctx.guilds.deleteRank('ra', 'r1_g1');
    expect(ctx.guilds.membership('u_Bert')?.rank_id).toBe('r1_g1');
    expect(ctx.guilds.membership('u_Anna')?.rank_id).toBe('r0_g1');
    expect(ctx.guilds.rank('ra')).toBeUndefined();
    // The rights of the deleted rank are gone; Mitglied keeps its own.
    expect(ctx.db.prepare('SELECT * FROM guild_rank_rights').all()).toEqual([
      { rank_id: 'r1_g1', right_key: 'chat-read' },
      { rank_id: 'r1_g1', right_key: 'chat-write' },
    ]);
  });

  it('hands over the Leitung with its rank; the old Leitung gets the rank it chose', () => {
    const ctx = setup();
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.accept('u_Bert');
    ctx.guilds.addRank('ra', 'g1', 'Offizier');
    ctx.guilds.addRank('rb', 'g1', 'Rekrut');
    ctx.guilds.transfer('g1', 'u_Bert', 'rb');
    expect(ctx.guilds.get('g1')?.founder).toBe('u_Bert');
    expect(ctx.guilds.membership('u_Bert')?.rank_id).toBe('r0_g1');
    expect(ctx.guilds.membership('u_Anna')?.rank_id).toBe('rb');
  });

  it('deletes a guild with its members, applications, ranks and rights', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.addRank('ra', 'g1', 'Offizier');
    ctx.guilds.setRights('ra', ['remove']);
    ctx.guilds.apply('u_Cora', 'g1');
    ctx.guilds.delete('g1');
    expect(ctx.guilds.get('g1')).toBeUndefined();
    expect(ctx.guilds.ranks('g1')).toEqual([]);
    expect(ctx.guilds.membership('u_Anna')).toBeUndefined();
    expect(ctx.guilds.membership('u_Cora')).toBeUndefined();
    expect(ctx.guilds.membership('u_Bert')?.guild_id).toBe('g2');
    expect(ctx.guilds.ranks('g2')).toHaveLength(2);
  });

  it('deletes the ranks and their rights with the guild', () => {
    const ctx = setup();
    ctx.guilds.addRank('ra', 'g1', 'Offizier');
    ctx.guilds.setRights('ra', ['profile']);
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.accept('u_Bert');
    ctx.guilds.setRank('u_Bert', 'ra');
    ctx.guilds.delete('g1');
    for (const t of ['guild_ranks', 'guild_rank_rights', 'guild_members'])
      expect(ctx.db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get(), t).toBe(
        0,
      );
  });

  it('deletes every guild with its members, applications, ranks and rights; the players stay (#191)', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.addRank('ra', 'g1', 'Offizier');
    ctx.guilds.setRights('ra', ['remove', 'profile']);
    ctx.guilds.apply('u_Cora', 'g2');
    ctx.guilds.addChat('g1', 'u_Anna', 1, 'Hallo');
    ctx.guilds.addChat('g2', 'u_Bert', 2, 'Hi');
    ctx.guilds.deleteAll();
    expect(ctx.guilds.all()).toEqual([]);
    expect(ctx.guilds.players()).toEqual([]);
    for (const t of [
      'guilds',
      'guild_members',
      'guild_ranks',
      'guild_rank_rights',
      'guild_chat',
    ])
      expect(ctx.db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get(), t).toBe(
        0,
      );
    expect(
      ctx.players
        .all()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Anna', 'Bert', 'Cora']);
    // A new round can found guilds again.
    ctx.guilds.create('g3', 'ABC', 'Alpha', '', 'u_Cora');
    expect(ctx.guilds.membership('u_Cora')?.rank_id).toBe('r0_g3');
  });
});

describe('guild chat repository (#169)', () => {
  const chat = (ctx: ReturnType<typeof setup>, id = 'g1') =>
    ctx.guilds.chat(id).map((m) => [m.author, m.time, m.text]);

  it('adds messages in their order, per guild, and finds one by its id', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    const first = ctx.guilds.addChat('g1', 'u_Anna', 10, 'Hallo');
    const other = ctx.guilds.addChat('g2', 'u_Bert', 11, 'Hi');
    const second = ctx.guilds.addChat('g1', 'u_Anna', 12, '<b>fett</b>');
    expect([first, other, second]).toEqual([1, 2, 3]);
    expect(chat(ctx)).toEqual([
      ['u_Anna', 10, 'Hallo'],
      ['u_Anna', 12, '<b>fett</b>'],
    ]);
    expect(chat(ctx, 'g2')).toEqual([['u_Bert', 11, 'Hi']]);
    expect(chat(ctx, 'none')).toEqual([]);
    expect(ctx.guilds.chatMessage(other)).toEqual({
      id: other,
      guild_id: 'g2',
      author: 'u_Bert',
      time: 11,
      text: 'Hi',
    });
    expect(ctx.guilds.chatMessage(99)).toBeUndefined();
  });

  it('keeps the newest 500 messages of each guild', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.addChat('g2', 'u_Bert', 0, 'bleibt');
    for (let i = 1; i <= 501; i++)
      ctx.guilds.addChat('g1', 'u_Anna', i, `Nr. ${i}`);
    const kept = ctx.guilds.chat('g1');
    expect(kept).toHaveLength(500);
    expect(kept[0]!.text).toBe('Nr. 2');
    expect(kept.at(-1)!.text).toBe('Nr. 501');
    expect(chat(ctx, 'g2')).toEqual([['u_Bert', 0, 'bleibt']]);
    ctx.guilds.addChat('g1', 'u_Anna', 502, 'Nr. 502');
    expect(ctx.guilds.chat('g1')[0]!.text).toBe('Nr. 3');
    expect(ctx.guilds.chat('g1')).toHaveLength(500);
  });

  it('deletes one message, finds the newest of a writer and clears every chat', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    const a = ctx.guilds.addChat('g1', 'u_Anna', 5, 'eins');
    ctx.guilds.addChat('g1', 'u_Anna', 7, 'zwei');
    ctx.guilds.addChat('g2', 'u_Bert', 9, 'drei');
    expect(ctx.guilds.lastChat('u_Anna')).toBe(7);
    expect(ctx.guilds.lastChat('u_Bert')).toBe(9);
    expect(ctx.guilds.lastChat('u_Cora')).toBeUndefined();
    ctx.guilds.deleteChat(a);
    expect(chat(ctx)).toEqual([['u_Anna', 7, 'zwei']]);
    ctx.guilds.clearChats();
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM guild_chat').pluck().get(),
    ).toBe(0);
    // The guilds stay.
    expect(ctx.guilds.all()).toHaveLength(2);
  });

  it("deletes the chat with its guild and keeps a deleted account's messages without a name", () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.addChat('g1', 'u_Anna', 1, 'weg');
    ctx.guilds.addChat('g2', 'u_Bert', 2, 'Bert');
    ctx.guilds.addChat('g2', 'u_Cora', 3, 'Cora');
    ctx.guilds.delete('g1');
    expect(chat(ctx, 'g1')).toEqual([]);
    ctx.db.prepare("DELETE FROM users WHERE id = 'u_Cora'").run();
    expect(chat(ctx, 'g2')).toEqual([
      ['u_Bert', 2, 'Bert'],
      [null, 3, 'Cora'],
    ]);
  });
});
