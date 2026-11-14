import { describe, expect, it } from 'vitest';
import type { GuildRight } from '../../core/guild-ranks.ts';
import { addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { guildState } from './guilds.ts';

// Guild ranks with configurable rights (#163). The messages are written out
// here, not imported, so a changed text is noticed.
const NO_RIGHT = 'Dazu fehlt deinem Rang das Recht.';
const LOWER = 'Das geht nur bei Rängen unter deinem.';
const LEAD = 'Das darf nur die Gildenleitung.';

type Data = Record<string, unknown>;

/**
 * A guild of Lea (Leitung) with the members Ada, Bo and Cy (Mitglied), the
 * applicant Pia and Out, who is in no guild.
 */
function setup() {
  const ctx = testCtx();
  for (const n of ['Lea', 'Ada', 'Bo', 'Cy', 'Pia', 'Out']) addUser(ctx, n);
  const run = (who: string, d: Data) => runAction(ctx, `u_${who}`, d);
  run('Lea', { type: 'createGuild', tag: 'OR', name: 'Outer Rim' });
  const id = ctx.guilds.membership('u_Lea')!.guild_id;
  for (const n of ['Ada', 'Bo', 'Cy', 'Pia'])
    run(n, { type: 'applyToGuild', id });
  for (const n of ['Ada', 'Bo', 'Cy'])
    run('Lea', { type: 'reviewGuildApplication', uid: `u_${n}`, accept: true });
  const rank = (name: string): string =>
    ctx.guilds.ranks(id).find((r) => r.name === name)!.id;
  const rankOf = (who: string): string | undefined => {
    const r = ctx.guilds.membership(`u_${who}`)?.rank_id;
    return ctx.guilds.ranks(id).find((x) => x.id === r)?.name;
  };
  /** Lea adds a rank, moves it right below the Leitung and gives it rights. */
  const officer = (rights: GuildRight[], name = 'Offizier'): string => {
    run('Lea', { type: 'createGuildRank', name });
    const r = rank(name);
    while (ctx.guilds.rank(r)!.position > ctx.guilds.ranks(id)[1]!.position)
      run('Lea', { type: 'moveGuildRank', rank: r, up: true });
    run('Lea', { type: 'setGuildRankRights', rank: r, rights });
    return r;
  };
  const names = () => ctx.guilds.ranks(id).map((r) => r.name);
  return { ctx, run, id, rank, rankOf, officer, names };
}

describe('the first ranks (#163)', () => {
  it('founds a guild with the Leitung and the default rank Mitglied', () => {
    const { ctx, id, rankOf, names } = setup();
    expect(names()).toEqual(['Leitung', 'Mitglied']);
    expect(rankOf('Lea')).toBe('Leitung');
    expect(rankOf('Ada')).toBe('Mitglied');
    expect(rankOf('Pia')).toBeUndefined();
    expect(ctx.guilds.get(id)!.default_rank).toBe(ctx.guilds.ranks(id)[1]!.id);
  });
});

describe('every right, allowed and refused (#163)', () => {
  /** An action Ada does that needs the right, and its answer. */
  const CASES: [GuildRight, (s: ReturnType<typeof setup>) => Data, string][] = [
    [
      'applications',
      () => ({ type: 'reviewGuildApplication', uid: 'u_Pia', accept: true }),
      'Bewerbung angenommen.',
    ],
    [
      'remove',
      () => ({ type: 'manageGuildMember', uid: 'u_Bo' }),
      'Mitglied entfernt.',
    ],
    [
      'assign',
      (s) => ({ type: 'assignGuildRank', uid: 'u_Bo', rank: s.rank('Rekrut') }),
      'Rang vergeben.',
    ],
    [
      'profile',
      () => ({ type: 'updateGuild', tag: 'NEW', name: 'Neue Grenze' }),
      'Gildenprofil gespeichert.',
    ],
    [
      'ranks',
      () => ({ type: 'createGuildRank', name: 'Kadett' }),
      'Rang angelegt.',
    ],
  ];

  for (const [right, action, answer] of CASES)
    it(`${right}: refused without the right, allowed with it`, () => {
      const s = setup();
      const others = CASES.map((c) => c[0]).filter((r) => r !== right);
      const r = s.officer(others);
      s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
      s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
      expect(() => s.run('Ada', action(s))).toThrow(NO_RIGHT);
      s.run('Lea', { type: 'setGuildRankRights', rank: r, rights: [right] });
      expect(s.run('Ada', action(s))).toBe(answer);
    });

  it('a member of the default rank has no right at first', () => {
    const s = setup();
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    for (const [, action] of CASES)
      expect(() => s.run('Ada', action(s))).toThrow(NO_RIGHT);
    expect(() =>
      s.run('Ada', {
        type: 'reviewGuildApplication',
        uid: 'u_Pia',
        accept: false,
      }),
    ).toThrow(NO_RIGHT);
  });

  it('the right for applications also rejects them', () => {
    const s = setup();
    const r = s.officer(['applications']);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    expect(
      s.run('Ada', {
        type: 'reviewGuildApplication',
        uid: 'u_Pia',
        accept: false,
      }),
    ).toBe('Bewerbung abgelehnt.');
    expect(s.ctx.guilds.membership('u_Pia')).toBeUndefined();
  });

  it('the Leitung holds every right', () => {
    const s = setup();
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    // Reversed: Bo gets a rank before he is removed.
    for (const [, action, answer] of [...CASES].reverse())
      expect(s.run('Lea', action(s))).toBe(answer);
  });

  it('refuses players outside the guild and applicants', () => {
    const s = setup();
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    for (const who of ['Out', 'Pia'])
      for (const [, action] of CASES)
        expect(() => s.run(who, action(s))).toThrow('Du bist in keiner Gilde.');
  });

  it('refuses unknown rights; dissolving and handing over are no rights', () => {
    const s = setup();
    const r = s.rank('Mitglied');
    for (const rights of [['dissolve'], ['transfer'], ['applications', 'x']])
      expect(() =>
        s.run('Lea', { type: 'setGuildRankRights', rank: r, rights }),
      ).toThrow('Dieses Recht gibt es nicht.');
    expect(() =>
      s.run('Lea', { type: 'setGuildRankRights', rank: r, rights: 'ranks' }),
    ).toThrow('Dieses Recht gibt es nicht.');
    expect(s.ctx.guilds.rank(r)!.rights).toEqual([]);
    expect(
      s.run('Lea', {
        type: 'setGuildRankRights',
        rank: r,
        rights: ['ranks', 'applications', 'ranks'],
      }),
    ).toBe('Rechte gespeichert.');
    expect(s.ctx.guilds.rank(r)!.rights).toEqual(['applications', 'ranks']);
  });
});

describe('only the Leitung (#163)', () => {
  const ALL: GuildRight[] = [
    'applications',
    'remove',
    'assign',
    'profile',
    'ranks',
  ];

  it('hands over the Leitung, even against a rank with all rights', () => {
    const s = setup();
    const r = s.officer(ALL);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    const handOver = (who: string, rank: unknown) =>
      s.run(who, {
        type: 'manageGuildMember',
        uid: 'u_Bo',
        transfer: true,
        rank,
      });
    expect(() => handOver('Ada', s.rank('Mitglied'))).toThrow(LEAD);
    // The Leitung chooses its own new rank (owner, 2026-11-14): one of the
    // guild, never the Leitung.
    s.run('Out', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
    const other = s.ctx.guilds.membership('u_Out')!.guild_id;
    for (const rank of [undefined, 'none', s.ctx.guilds.ranks(other)[1]!.id])
      expect(() => handOver('Lea', rank)).toThrow('Diesen Rang gibt es nicht.');
    expect(() => handOver('Lea', s.rank('Leitung'))).toThrow(
      'Wähle für dich einen Rang unter der Leitung.',
    );
    expect(s.ctx.guilds.get(s.id)!.founder).toBe('u_Lea');
    expect(handOver('Lea', s.rank('Mitglied'))).toBe(
      'Gildenleitung übergeben.',
    );
    expect(s.ctx.guilds.get(s.id)!.founder).toBe('u_Bo');
    expect(s.rankOf('Bo')).toBe('Leitung');
    expect(s.rankOf('Lea')).toBe('Mitglied');
    expect(() =>
      s.run('Lea', { type: 'createGuildRank', name: 'Kadett' }),
    ).toThrow(NO_RIGHT);
    expect(s.run('Bo', { type: 'createGuildRank', name: 'Kadett' })).toBe(
      'Rang angelegt.',
    );
  });

  it('keeps the rank the old Leitung chose, with its rights', () => {
    const s = setup();
    const r = s.officer(['ranks']);
    expect(
      s.run('Lea', {
        type: 'manageGuildMember',
        uid: 'u_Ada',
        transfer: true,
        rank: r,
      }),
    ).toBe('Gildenleitung übergeben.');
    expect([s.rankOf('Ada'), s.rankOf('Lea')]).toEqual(['Leitung', 'Offizier']);
    expect(s.run('Lea', { type: 'createGuildRank', name: 'Kadett' })).toBe(
      'Rang angelegt.',
    );
    expect(() =>
      s.run('Lea', {
        type: 'manageGuildMember',
        uid: 'u_Ada',
        transfer: true,
        rank: r,
      }),
    ).toThrow(LEAD);
  });

  it('chooses the default rank', () => {
    const s = setup();
    const r = s.officer(ALL);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    expect(() =>
      s.run('Ada', { type: 'setGuildDefaultRank', rank: s.rank('Mitglied') }),
    ).toThrow(LEAD);
    expect(() =>
      s.run('Out', { type: 'setGuildDefaultRank', rank: s.rank('Mitglied') }),
    ).toThrow('Du bist in keiner Gilde.');
    expect(
      s.run('Lea', { type: 'setGuildDefaultRank', rank: s.rank('Offizier') }),
    ).toBe('Standardrang gesetzt.');
    s.run('Lea', {
      type: 'reviewGuildApplication',
      uid: 'u_Pia',
      accept: true,
    });
    expect(s.rankOf('Pia')).toBe('Offizier');
  });

  it('dissolves the guild, as its last member', () => {
    const s = setup();
    const r = s.officer(ALL);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    expect(() => s.run('Lea', { type: 'leaveGuild' })).toThrow(
      'Übergib zuerst die Gildenleitung.',
    );
    expect(s.run('Ada', { type: 'leaveGuild' })).toBe('Gilde verlassen.');
    for (const n of ['Bo', 'Cy']) s.run(n, { type: 'leaveGuild' });
    s.run('Pia', { type: 'leaveGuild' });
    expect(s.run('Lea', { type: 'leaveGuild' })).toBe('Gilde aufgelöst.');
    expect(s.ctx.guilds.get(s.id)).toBeUndefined();
    expect(s.ctx.guilds.ranks(s.id)).toEqual([]);
  });

  it('there is always exactly one Leitung: its rank cannot be given', () => {
    const s = setup();
    const lead = s.rank('Leitung');
    expect(() =>
      s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: lead }),
    ).toThrow(LOWER);
    expect(() =>
      s.run('Lea', { type: 'setGuildDefaultRank', rank: lead }),
    ).toThrow('Die Leitung kann nicht der Standardrang sein.');
    expect(
      s.ctx.db
        .prepare('SELECT COUNT(*) FROM guild_members WHERE rank_id = ?')
        .pluck()
        .get(lead),
    ).toBe(1);
  });
});

describe('dissolving the guild with members (#163, owner 2026-11-14)', () => {
  const DISSOLVE = 'Nur die Gildenleitung kann die Gilde auflösen.';
  const dissolve = (s: ReturnType<typeof setup>, who: string, tag: unknown) =>
    s.run(who, { type: 'dissolveGuild', tag });

  it('only the Leitung, never a rank with all rights', () => {
    const s = setup();
    const r = s.officer([
      'applications',
      'remove',
      'assign',
      'profile',
      'ranks',
    ]);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    for (const who of ['Ada', 'Bo'])
      expect(() => dissolve(s, who, 'OR')).toThrow(DISSOLVE);
    for (const who of ['Pia', 'Out'])
      expect(() => dissolve(s, who, 'OR')).toThrow('Du bist in keiner Gilde.');
    expect(s.ctx.guilds.get(s.id)).toBeDefined();
  });

  it('asks for the tag of the guild', () => {
    const s = setup();
    for (const tag of ['', undefined, 'XY', 'ORX', 'Outer Rim'])
      expect(() => dissolve(s, 'Lea', tag)).toThrow('Das Kürzel stimmt nicht.');
    expect(s.ctx.guilds.get(s.id)).toBeDefined();
    expect(dissolve(s, 'Lea', ' or ')).toBe('Gilde aufgelöst.');
  });

  it('removes every member, application, rank and right, and nothing else', () => {
    const s = setup();
    s.officer(['remove']);
    s.run('Out', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
    const other = s.ctx.guilds.membership('u_Out')!.guild_id;
    const count = (sql: string) =>
      s.ctx.db.prepare(sql).pluck().get(s.id) as number;
    expect(dissolve(s, 'Lea', 'OR')).toBe('Gilde aufgelöst.');
    expect(s.ctx.guilds.get(s.id)).toBeUndefined();
    for (const n of ['Lea', 'Ada', 'Bo', 'Cy', 'Pia'])
      expect(s.ctx.guilds.membership(`u_${n}`), n).toBeUndefined();
    expect(count('SELECT COUNT(*) FROM guild_ranks WHERE guild_id = ?')).toBe(
      0,
    );
    expect(
      s.ctx.db.prepare('SELECT COUNT(*) FROM guild_rank_rights').pluck().get(),
    ).toBe(0);
    expect(s.ctx.guilds.ranks(other)).toHaveLength(2);
    expect(s.ctx.guilds.membership('u_Out')?.guild_id).toBe(other);
    expect(s.ctx.players.get('u_Ada')).toMatchObject({ name: 'Ada' });
    // The former members may found or join a guild again.
    expect(s.run('Ada', { type: 'applyToGuild', id: other })).toBe(
      'Bewerbung gesendet.',
    );
    expect(
      s.run('Lea', { type: 'createGuild', tag: 'OR', name: 'Outer Rim' }),
    ).toBe('Gilde gegründet.');
  });
});

describe('the order of the ranks (#163)', () => {
  /** Offizier (rights given) right below the Leitung, Ada holds it. */
  function ranked(rights: GuildRight[]) {
    const s = setup();
    const r = s.officer(rights);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    return { ...s, officer: r };
  }

  it('acts only on members of a lower rank', () => {
    const s = ranked(['remove', 'assign']);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Bo', rank: s.officer });
    for (const uid of ['u_Bo', 'u_Lea'])
      expect(() => s.run('Ada', { type: 'manageGuildMember', uid })).toThrow(
        LOWER,
      );
    expect(() =>
      s.run('Ada', {
        type: 'assignGuildRank',
        uid: 'u_Bo',
        rank: s.rank('Mitglied'),
      }),
    ).toThrow(LOWER);
    expect(s.run('Ada', { type: 'manageGuildMember', uid: 'u_Cy' })).toBe(
      'Mitglied entfernt.',
    );
  });

  it('gives only ranks below its own', () => {
    const s = ranked(['assign']);
    for (const rank of [s.officer, s.rank('Leitung')])
      expect(() =>
        s.run('Ada', { type: 'assignGuildRank', uid: 'u_Bo', rank }),
      ).toThrow(LOWER);
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    expect(
      s.run('Ada', {
        type: 'assignGuildRank',
        uid: 'u_Bo',
        rank: s.rank('Rekrut'),
      }),
    ).toBe('Rang vergeben.');
    expect(s.rankOf('Bo')).toBe('Rekrut');
    // Not to itself, not to the other guild or a stranger.
    expect(() =>
      s.run('Ada', {
        type: 'assignGuildRank',
        uid: 'u_Ada',
        rank: s.rank('Rekrut'),
      }),
    ).toThrow(LOWER);
    for (const uid of ['u_Pia', 'u_Out', 'nobody'])
      expect(() =>
        s.run('Ada', { type: 'assignGuildRank', uid, rank: s.rank('Rekrut') }),
      ).toThrow('Dieses Gildenmitglied gibt es nicht.');
    expect(() =>
      s.run('Ada', { type: 'assignGuildRank', uid: 'u_Bo', rank: 'none' }),
    ).toThrow('Diesen Rang gibt es nicht.');
  });

  it('manages only ranks below its own', () => {
    const s = ranked(['ranks']);
    for (const rank of [s.officer, s.rank('Leitung')]) {
      expect(() =>
        s.run('Ada', { type: 'renameGuildRank', rank, name: 'Neu' }),
      ).toThrow(LOWER);
      expect(() =>
        s.run('Ada', { type: 'setGuildRankRights', rank, rights: [] }),
      ).toThrow(LOWER);
      expect(() => s.run('Ada', { type: 'deleteGuildRank', rank })).toThrow(
        LOWER,
      );
      expect(() =>
        s.run('Ada', { type: 'moveGuildRank', rank, up: false }),
      ).toThrow(LOWER);
    }
    expect(
      s.run('Ada', {
        type: 'renameGuildRank',
        rank: s.rank('Mitglied'),
        name: 'Gefolge',
      }),
    ).toBe('Rang umbenannt.');
    expect(s.names()).toEqual(['Leitung', 'Offizier', 'Gefolge']);
  });

  it('gives and takes only rights it holds', () => {
    const s = ranked(['ranks', 'applications']);
    const member = s.rank('Mitglied');
    const rights = (r: unknown) => ({
      type: 'setGuildRankRights',
      rank: member,
      rights: r,
    });
    expect(() => s.run('Ada', rights(['remove']))).toThrow(NO_RIGHT);
    expect(s.run('Ada', rights(['applications']))).toBe('Rechte gespeichert.');
    expect(s.ctx.guilds.rank(member)!.rights).toEqual(['applications']);
    // A right the Leitung gave stays unless Ada holds it too.
    s.run('Lea', rights(['applications', 'profile']));
    expect(() => s.run('Ada', rights([]))).toThrow(NO_RIGHT);
    expect(s.run('Ada', rights(['profile']))).toBe('Rechte gespeichert.');
    expect(s.ctx.guilds.rank(member)!.rights).toEqual(['profile']);
    // Saving unchanged rights it does not hold is no change.
    expect(s.run('Ada', rights(['profile']))).toBe('Rechte gespeichert.');
  });

  it('moves ranks below its own, not above it', () => {
    const s = ranked(['ranks']);
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    expect(s.names()).toEqual(['Leitung', 'Offizier', 'Mitglied', 'Rekrut']);
    expect(() =>
      s.run('Ada', {
        type: 'moveGuildRank',
        rank: s.rank('Mitglied'),
        up: true,
      }),
    ).toThrow(LOWER);
    expect(() =>
      s.run('Ada', {
        type: 'moveGuildRank',
        rank: s.rank('Rekrut'),
        up: false,
      }),
    ).toThrow('Der Rang steht schon ganz unten.');
    expect(
      s.run('Ada', {
        type: 'moveGuildRank',
        rank: s.rank('Mitglied'),
        up: false,
      }),
    ).toBe('Rang verschoben.');
    expect(s.names()).toEqual(['Leitung', 'Offizier', 'Rekrut', 'Mitglied']);
    expect(
      s.run('Ada', {
        type: 'moveGuildRank',
        rank: s.rank('Mitglied'),
        up: true,
      }),
    ).toBe('Rang verschoben.');
    expect(s.names()).toEqual(['Leitung', 'Offizier', 'Mitglied', 'Rekrut']);
    // The Leitung cannot move a rank above itself either.
    expect(() =>
      s.run('Lea', { type: 'moveGuildRank', rank: s.officer, up: true }),
    ).toThrow(LOWER);
  });

  it('a member without a rank has no right and stands lowest', () => {
    const s = ranked(['remove']);
    s.ctx.db
      .prepare('UPDATE guild_members SET rank_id = NULL WHERE user_id = ?')
      .run('u_Bo');
    expect(() =>
      s.run('Bo', { type: 'manageGuildMember', uid: 'u_Cy' }),
    ).toThrow(NO_RIGHT);
    expect(s.run('Ada', { type: 'manageGuildMember', uid: 'u_Bo' })).toBe(
      'Mitglied entfernt.',
    );
  });
});

describe('deleting a rank and the default rank (#163)', () => {
  it('moves the members of a deleted rank to the default rank', () => {
    const s = setup();
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    const recruit = s.rank('Rekrut');
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: recruit,
      rights: ['remove'],
    });
    for (const uid of ['u_Ada', 'u_Bo'])
      s.run('Lea', { type: 'assignGuildRank', uid, rank: recruit });
    expect(s.run('Lea', { type: 'deleteGuildRank', rank: recruit })).toBe(
      'Rang gelöscht.',
    );
    expect([s.rankOf('Ada'), s.rankOf('Bo'), s.rankOf('Lea')]).toEqual([
      'Mitglied',
      'Mitglied',
      'Leitung',
    ]);
    expect(s.names()).toEqual(['Leitung', 'Mitglied']);
    expect(s.ctx.guilds.rank(recruit)).toBeUndefined();
  });

  it('never deletes the default rank or the Leitung; at least two ranks stay', () => {
    const s = setup();
    expect(() =>
      s.run('Lea', { type: 'deleteGuildRank', rank: s.rank('Mitglied') }),
    ).toThrow('Der Standardrang kann nicht gelöscht werden.');
    expect(() =>
      s.run('Lea', { type: 'deleteGuildRank', rank: s.rank('Leitung') }),
    ).toThrow(LOWER);
    expect(s.names()).toEqual(['Leitung', 'Mitglied']);
    // Another default first; then the old one goes, and its members move.
    s.run('Lea', { type: 'createGuildRank', name: 'Rekrut' });
    s.run('Lea', { type: 'setGuildDefaultRank', rank: s.rank('Rekrut') });
    expect(
      s.run('Lea', { type: 'deleteGuildRank', rank: s.rank('Mitglied') }),
    ).toBe('Rang gelöscht.');
    expect(s.names()).toEqual(['Leitung', 'Rekrut']);
    expect(s.rankOf('Ada')).toBe('Rekrut');
    expect(() =>
      s.run('Lea', { type: 'deleteGuildRank', rank: s.rank('Rekrut') }),
    ).toThrow('Der Standardrang kann nicht gelöscht werden.');
  });

  it('refuses a rank of another guild and an unknown rank', () => {
    const s = setup();
    s.run('Out', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
    const other = s.ctx.guilds.membership('u_Out')!.guild_id;
    const foreign = s.ctx.guilds.ranks(other)[1]!.id;
    for (const rank of [foreign, 'none', undefined]) {
      for (const d of [
        { type: 'deleteGuildRank', rank },
        { type: 'renameGuildRank', rank, name: 'Neu' },
        { type: 'setGuildRankRights', rank, rights: [] },
        { type: 'moveGuildRank', rank, up: true },
        { type: 'setGuildDefaultRank', rank },
      ])
        expect(() => s.run('Lea', d), d.type).toThrow(
          'Diesen Rang gibt es nicht.',
        );
    }
    expect(s.ctx.guilds.ranks(other).map((r) => r.name)).toEqual([
      'Leitung',
      'Mitglied',
    ]);
  });
});

describe('the limits of the ranks (#163)', () => {
  it('allows at most 25 ranks, the Leitung included', () => {
    const s = setup();
    for (let i = 3; i <= 25; i++)
      expect(s.run('Lea', { type: 'createGuildRank', name: `Rang ${i}` })).toBe(
        'Rang angelegt.',
      );
    expect(s.names()).toHaveLength(25);
    expect(() =>
      s.run('Lea', { type: 'createGuildRank', name: 'Rang 26' }),
    ).toThrow('Eine Gilde hat höchstens 25 Ränge.');
    s.run('Lea', { type: 'deleteGuildRank', rank: s.rank('Rang 25') });
    expect(s.run('Lea', { type: 'createGuildRank', name: 'Rang 26' })).toBe(
      'Rang angelegt.',
    );
  });

  it('takes a name of 2 to 67 characters, once per guild', () => {
    const s = setup();
    const create = (name: unknown) =>
      s.run('Lea', { type: 'createGuildRank', name });
    const tooShortOrLong = 'Der Rangname braucht 2 bis 67 Zeichen.';
    for (const name of ['', 'a', '   b   ', 'x'.repeat(68), undefined])
      expect(() => create(name)).toThrow(tooShortOrLong);
    expect(create('ab')).toBe('Rang angelegt.');
    expect(create(` ${'y'.repeat(67)} `)).toBe('Rang angelegt.');
    expect(s.names()).toEqual(['Leitung', 'Mitglied', 'ab', 'y'.repeat(67)]);
    for (const name of ['AB', 'mitglied', 'LEITUNG'])
      expect(() => create(name)).toThrow(
        'Diesen Rangnamen gibt es in der Gilde schon.',
      );
    const rename = (name: unknown) =>
      s.run('Lea', { type: 'renameGuildRank', rank: s.rank('ab'), name });
    expect(() => rename('x')).toThrow(tooShortOrLong);
    expect(() => rename('x'.repeat(68))).toThrow(tooShortOrLong);
    expect(() => rename('Mitglied')).toThrow(
      'Diesen Rangnamen gibt es in der Gilde schon.',
    );
    expect(rename('AB')).toBe('Rang umbenannt.');
    expect(s.names()[2]).toBe('AB');
    // Another guild may use the same name.
    s.run('Out', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
    expect(s.run('Out', { type: 'createGuildRank', name: 'AB' })).toBe(
      'Rang angelegt.',
    );
  });
});

describe('what the guild view shows (#163)', () => {
  it('shows the ranks only inside the guild', () => {
    const s = setup();
    const r = s.officer(['applications', 'remove']);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    const outside = guildState(s.ctx, 'u_Out', {});
    expect(outside.ranks).toBeNull();
    expect(outside.management).toBeNull();
    // A second guild, whose members stay out of the first one's ranks.
    addUser(s.ctx, 'Zed');
    s.run('Zed', { type: 'createGuild', tag: 'ZZ', name: 'Zenit' });
    expect(guildState(s.ctx, 'u_Pia', {}).ranks).toBeNull();
    const shown = JSON.stringify(outside.directory);
    expect(shown).not.toContain('Offizier');
    expect(shown).not.toContain('Leitung');
    expect(outside.directory[0]).not.toHaveProperty('founder');
    const first = guildState(s.ctx, 'u_Out', {}).directory.find(
      (g) => g.id === s.id,
    )!;
    expect(first.members.map((m) => Object.keys(m))).toEqual([
      ['id', 'name', 'points'],
      ['id', 'name', 'points'],
      ['id', 'name', 'points'],
      ['id', 'name', 'points'],
    ]);

    const [lead, officer, member] = s.ctx.guilds.ranks(s.id);
    const inside = guildState(s.ctx, 'u_Ada', {});
    expect(inside.ranks).toEqual({
      lead: 'u_Lea',
      rank: officer!.id,
      rights: ['applications', 'remove'],
      default: member!.id,
      list: [
        {
          id: lead!.id,
          name: 'Leitung',
          rights: ['applications', 'remove', 'assign', 'profile', 'ranks'],
        },
        {
          id: officer!.id,
          name: 'Offizier',
          rights: ['applications', 'remove'],
        },
        { id: member!.id, name: 'Mitglied', rights: [] },
      ],
      members: {
        u_Lea: lead!.id,
        u_Ada: officer!.id,
        u_Bo: member!.id,
        u_Cy: member!.id,
      },
    });
    expect(guildState(s.ctx, 'u_Lea', {}).ranks).toMatchObject({
      rank: lead!.id,
      rights: ['applications', 'remove', 'assign', 'profile', 'ranks'],
    });
  });

  it('lists the applications only for a rank with the right', () => {
    const s = setup();
    const pending = [{ id: 'u_Pia', name: 'Pia' }];
    expect(guildState(s.ctx, 'u_Lea', {}).management).toEqual({
      id: s.id,
      description: '',
      pending,
    });
    expect(guildState(s.ctx, 'u_Ada', {}).management).toEqual({
      id: s.id,
      description: '',
      pending: [],
    });
    const r = s.officer(['applications']);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    expect(guildState(s.ctx, 'u_Ada', {}).management?.pending).toEqual(pending);
  });
});
