import { describe, expect, it } from 'vitest';
import type { GuildRight } from '../../core/guild-ranks.ts';
import { addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';

// #214: every refusal of the guild actions with its exact message, and the
// order when two apply. The checks are pure functions of
// src/core/guild-checks.ts; these tests pin the server's answer, so a moved
// check keeps its words and its order. The messages are written out here,
// not imported.
const JOINED = 'Du hast bereits eine Gilde oder eine offene Bewerbung.';
const OUTSIDE = 'Du bist in keiner Gilde.';
const NO_RIGHT = 'Dazu fehlt deinem Rang das Recht.';
const LOWER = 'Das geht nur bei Rängen unter deinem.';
const LEAD = 'Das darf nur die Gildenleitung.';
const NO_MEMBER = 'Dieses Gildenmitglied gibt es nicht.';
const NO_RANK = 'Diesen Rang gibt es nicht.';
const NAME = 'Der Rangname braucht 2 bis 24 Zeichen.';
const TAG = 'Das Kürzel braucht 2 bis 8 Buchstaben oder Ziffern.';
const GUILD_NAME = 'Der Gildenname braucht 3 bis 32 Zeichen.';
const TEXT = 'Der Gildentext darf höchstens 6.000 Zeichen haben.';
const TAKEN = 'Das Kürzel oder der Name ist schon vergeben.';

type Data = Record<string, unknown>;

/**
 * A guild of Lea (Leitung) with the members Ada, Bo and Cy (Mitglied), the
 * applicant Pia; Out leads another guild, Free is in none.
 */
function setup() {
  const ctx = testCtx();
  for (const n of ['Lea', 'Ada', 'Bo', 'Cy', 'Pia', 'Out', 'Free'])
    addUser(ctx, n);
  const run = (who: string, d: Data) => runAction(ctx, `u_${who}`, d);
  run('Lea', { type: 'createGuild', tag: 'OR', name: 'Outer Rim' });
  const id = ctx.guilds.membership('u_Lea')!.guild_id;
  for (const n of ['Ada', 'Bo', 'Cy', 'Pia'])
    run(n, { type: 'applyToGuild', id });
  for (const n of ['Ada', 'Bo', 'Cy'])
    run('Lea', { type: 'reviewGuildApplication', uid: `u_${n}`, accept: true });
  run('Out', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
  const rank = (name: string): string =>
    ctx.guilds.ranks(id).find((r) => r.name === name)!.id;
  /** Lea adds a rank right below the Leitung with `rights` and gives it to Ada. */
  const officer = (rights: GuildRight[], name = 'Offizier') => {
    run('Lea', { type: 'createGuildRank', name });
    const r = rank(name);
    while (ctx.guilds.rank(r)!.position > ctx.guilds.ranks(id)[1]!.position)
      run('Lea', { type: 'moveGuildRank', rank: r, up: true });
    run('Lea', { type: 'setGuildRankRights', rank: r, rights });
    run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: r });
    return r;
  };
  return { ctx, run, id, rank, officer };
}

const refused = (
  s: ReturnType<typeof setup>,
  who: string,
  d: Data,
  message: string,
) => expect(() => s.run(who, d), JSON.stringify(d)).toThrow(message);

describe('the order of the refusals of a profile (#214)', () => {
  const found = (d: Data): Data => ({
    type: 'createGuild',
    tag: 'ZZ',
    name: 'Zeta',
    ...d,
  });

  it('asks the tag, the name, the text and then whether it is taken', () => {
    const s = setup();
    const long = 'x'.repeat(6001);
    refused(s, 'Free', found({ tag: 'X', name: 'ab', description: long }), TAG);
    refused(s, 'Free', found({ name: 'ab', description: long }), GUILD_NAME);
    refused(s, 'Free', found({ tag: 'or', description: long }), TEXT);
    refused(s, 'Free', found({ tag: 'or' }), TAKEN);
    refused(s, 'Free', found({ name: 'Outer Rim' }), TAKEN);
  });

  it('refuses the tag by its characters, after upper case and trimming', () => {
    const s = setup();
    refused(s, 'Free', found({ tag: 'a-b' }), TAG);
    refused(s, 'Free', found({ tag: '  z  ' }), TAG);
    expect(s.run('Free', found({ tag: ' zz ', name: ' Zeta ' }))).toBe(
      'Gilde gegründet.',
    );
  });

  it('the update asks the actor first, then the right, then the profile', () => {
    const s = setup();
    const update = (d: Data): Data => ({
      type: 'updateGuild',
      tag: 'OR',
      name: 'Outer Rim',
      ...d,
    });
    refused(s, 'Free', update({ tag: 'X' }), OUTSIDE);
    refused(s, 'Pia', update({ tag: 'X' }), OUTSIDE);
    refused(s, 'Bo', update({ tag: 'X' }), NO_RIGHT);
    refused(s, 'Lea', update({ tag: 'X', name: 'ab' }), TAG);
    refused(
      s,
      'Lea',
      update({ name: 'ab', description: 'x'.repeat(6001) }),
      GUILD_NAME,
    );
    refused(
      s,
      'Lea',
      update({ description: 'x'.repeat(6001), tag: 'XY' }),
      TEXT,
    );
    refused(s, 'Lea', update({ tag: 'xy' }), TAKEN);
    refused(s, 'Lea', update({ name: 'xylon' }), TAKEN);
    expect(s.run('Lea', update({ tag: 'or' }))).toBe(
      'Gildenprofil gespeichert.',
    );
  });
});

describe('the other basic actions (#214)', () => {
  it('applying: a guild or an application first, then the guild must exist', () => {
    const s = setup();
    refused(s, 'Bo', { type: 'applyToGuild', id: 'none' }, JOINED);
    refused(s, 'Pia', { type: 'applyToGuild', id: s.id }, JOINED);
    refused(
      s,
      'Free',
      { type: 'applyToGuild', id: 'none' },
      'Diese Gilde gibt es nicht.',
    );
    refused(s, 'Free', { type: 'applyToGuild' }, 'Diese Gilde gibt es nicht.');
  });

  it('reviewing: the actor, the right, then an open application of the guild', () => {
    const s = setup();
    const review = { type: 'reviewGuildApplication', accept: true };
    const none = 'Diese Bewerbung gibt es nicht.';
    refused(s, 'Free', { ...review, uid: 'u_Pia' }, OUTSIDE);
    refused(s, 'Bo', { ...review, uid: 'nobody' }, NO_RIGHT);
    refused(s, 'Lea', { ...review, uid: 'nobody' }, none);
    // A member, an applicant of another guild and the player itself.
    refused(s, 'Lea', { ...review, uid: 'u_Bo' }, none);
    refused(s, 'Lea', { ...review, uid: 'u_Out' }, none);
    refused(s, 'Lea', { ...review, uid: 'u_Lea' }, none);
    s.run('Free', {
      type: 'applyToGuild',
      id: s.ctx.guilds.membership('u_Out')!.guild_id,
    });
    refused(s, 'Lea', { ...review, uid: 'u_Free' }, none);
  });

  it('leaving: the Leitung only without other members', () => {
    const s = setup();
    refused(s, 'Free', { type: 'leaveGuild' }, OUTSIDE);
    refused(
      s,
      'Lea',
      { type: 'leaveGuild' },
      'Übergib zuerst die Gildenleitung.',
    );
    expect(s.run('Pia', { type: 'leaveGuild' })).toBe(
      'Bewerbung zurückgezogen.',
    );
    expect(s.run('Bo', { type: 'leaveGuild' })).toBe('Gilde verlassen.');
    expect(s.run('Out', { type: 'leaveGuild' })).toBe('Gilde aufgelöst.');
  });

  it('managing a member: the member first, then the Leitung, the right and the place', () => {
    const s = setup();
    s.officer(['remove']);
    const hand = (rank: unknown, uid = 'u_Bo'): Data => ({
      type: 'manageGuildMember',
      uid,
      transfer: true,
      rank,
    });
    refused(s, 'Free', { type: 'manageGuildMember', uid: 'u_Bo' }, OUTSIDE);
    // The member comes before the hand-over, whoever hands over.
    refused(s, 'Ada', hand(undefined, 'u_Ada'), NO_MEMBER);
    refused(s, 'Ada', hand(undefined, 'u_Pia'), NO_MEMBER);
    refused(s, 'Ada', hand(undefined, 'u_Out'), NO_MEMBER);
    refused(s, 'Lea', hand('x', 'u_Lea'), NO_MEMBER);
    refused(s, 'Ada', hand(s.rank('Mitglied')), LEAD);
    refused(s, 'Lea', hand('none'), NO_RANK);
    refused(
      s,
      'Lea',
      hand(s.rank('Leitung')),
      'Wähle für dich einen Rang unter der Leitung.',
    );
    // A removal: the right, then the place.
    refused(s, 'Bo', { type: 'manageGuildMember', uid: 'u_Cy' }, NO_RIGHT);
    refused(s, 'Ada', { type: 'manageGuildMember', uid: 'u_Lea' }, LOWER);
    expect(s.run('Ada', { type: 'manageGuildMember', uid: 'u_Cy' })).toBe(
      'Mitglied entfernt.',
    );
  });

  it('dissolving: the Leitung first, then the tag in any case', () => {
    const s = setup();
    const dissolve = (tag: unknown): Data => ({ type: 'dissolveGuild', tag });
    const only = 'Nur die Gildenleitung kann die Gilde auflösen.';
    refused(s, 'Free', dissolve('OR'), OUTSIDE);
    refused(s, 'Ada', dissolve('nope'), only);
    refused(s, 'Lea', dissolve('nope'), 'Das Kürzel stimmt nicht.');
    refused(s, 'Lea', dissolve(undefined), 'Das Kürzel stimmt nicht.');
    expect(s.run('Lea', dissolve('or'))).toBe('Gilde aufgelöst.');
  });
});

describe('the order of the refusals of the rank actions (#214)', () => {
  const ranks = (s: ReturnType<typeof setup>) => s.ctx.guilds.ranks(s.id);

  it('creating: the right, then room for one more, then the name', () => {
    const s = setup();
    s.officer(['remove']);
    refused(s, 'Ada', { type: 'createGuildRank', name: 'x' }, NO_RIGHT);
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: s.rank('Offizier'),
      rights: ['ranks'],
    });
    refused(s, 'Ada', { type: 'createGuildRank', name: 'x' }, NAME);
    refused(
      s,
      'Ada',
      { type: 'createGuildRank', name: 'MITGLIED' },
      'Diesen Rangnamen gibt es in der Gilde schon.',
    );
    while (ranks(s).length < 25)
      s.run('Lea', {
        type: 'createGuildRank',
        name: `Rang ${ranks(s).length}`,
      });
    refused(
      s,
      'Ada',
      { type: 'createGuildRank', name: 'x' },
      'Eine Gilde hat höchstens 25 Ränge.',
    );
  });

  it('every rank action first: the actor, the right, the rank, its place', () => {
    const s = setup();
    s.officer(['assign']);
    const lead = s.rank('Leitung');
    const actions = (rank: unknown): Data[] => [
      { type: 'renameGuildRank', rank, name: 'x' },
      { type: 'setGuildRankRights', rank, rights: ['zzz'] },
      { type: 'moveGuildRank', rank, up: true },
      { type: 'deleteGuildRank', rank },
    ];
    for (const d of actions(s.rank('Mitglied'))) refused(s, 'Free', d, OUTSIDE);
    // Ada holds „assign“ only: the right before the rank, known or not.
    for (const d of [...actions('none'), ...actions(lead)])
      refused(s, 'Ada', d, NO_RIGHT);
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: s.rank('Offizier'),
      rights: ['ranks'],
    });
    for (const d of actions('none')) refused(s, 'Ada', d, NO_RANK);
    for (const d of actions(lead)) refused(s, 'Ada', d, LOWER);
    for (const d of actions(s.rank('Offizier'))) refused(s, 'Ada', d, LOWER);
  });

  it('renaming: a rank it may change, then the length, then a name already taken', () => {
    const s = setup();
    s.officer(['ranks']);
    const mitglied = s.rank('Mitglied');
    refused(
      s,
      'Ada',
      { type: 'renameGuildRank', rank: mitglied, name: 'a' },
      NAME,
    );
    refused(
      s,
      'Ada',
      { type: 'renameGuildRank', rank: mitglied, name: 'x'.repeat(25) },
      NAME,
    );
    refused(
      s,
      'Ada',
      { type: 'renameGuildRank', rank: mitglied, name: 'offizier' },
      'Diesen Rangnamen gibt es in der Gilde schon.',
    );
    // Its own name, in another case, is no other rank's.
    expect(
      s.run('Ada', {
        type: 'renameGuildRank',
        rank: mitglied,
        name: 'MITGLIED',
      }),
    ).toBe('Rang umbenannt.');
  });

  it('setting rights: the rank, then a known list, then only rights it holds', () => {
    const s = setup();
    s.officer(['ranks', 'assign']);
    const rank = s.rank('Mitglied');
    const set = (rights: unknown): Data => ({
      type: 'setGuildRankRights',
      rank,
      rights,
    });
    refused(
      s,
      'Ada',
      set(['applications', 'zzz']),
      'Dieses Recht gibt es nicht.',
    );
    refused(s, 'Ada', set('assign'), 'Dieses Recht gibt es nicht.');
    refused(s, 'Ada', set(undefined), 'Dieses Recht gibt es nicht.');
    refused(s, 'Ada', set(['applications']), NO_RIGHT);
    const kept: GuildRight[] = ['chat-read', 'chat-write'];
    expect(s.run('Ada', set([...kept, 'assign']))).toBe('Rechte gespeichert.');
    expect(s.run('Ada', set(kept))).toBe('Rechte gespeichert.');
  });

  it('moving: a rank it may change, then a neighbour that exists and is below it', () => {
    const s = setup();
    s.officer(['ranks']);
    s.run('Lea', { type: 'createGuildRank', name: 'Letzter' });
    const first = s.rank('Mitglied');
    // The first rank below the officer would pass the officer.
    refused(
      s,
      'Ada',
      { type: 'moveGuildRank', rank: s.rank('Offizier'), up: true },
      LOWER,
    );
    refused(s, 'Ada', { type: 'moveGuildRank', rank: first, up: true }, LOWER);
    refused(
      s,
      'Ada',
      { type: 'moveGuildRank', rank: s.rank('Letzter') },
      'Der Rang steht schon ganz unten.',
    );
    expect(
      s.run('Ada', {
        type: 'moveGuildRank',
        rank: s.rank('Letzter'),
        up: true,
      }),
    ).toBe('Rang verschoben.');
  });

  it('deleting: the default rank, then a default rank the actor could give', () => {
    const s = setup();
    s.officer(['ranks']);
    const DELETE =
      'Der Rang hat Mitglieder, und der Standardrang steht nicht unter deinem oder hat ein Recht, das dir fehlt.';
    s.run('Lea', { type: 'createGuildRank', name: 'Neu' });
    const fresh = s.rank('Neu');
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Bo', rank: fresh });
    refused(
      s,
      'Ada',
      { type: 'deleteGuildRank', rank: s.rank('Mitglied') },
      'Der Standardrang kann nicht gelöscht werden.',
    );
    // The default rank holds a right Ada lacks.
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: s.rank('Mitglied'),
      rights: ['remove'],
    });
    refused(s, 'Ada', { type: 'deleteGuildRank', rank: fresh }, DELETE);
    s.run('Lea', {
      type: 'assignGuildRank',
      uid: 'u_Bo',
      rank: s.rank('Mitglied'),
    });
    expect(s.run('Ada', { type: 'deleteGuildRank', rank: fresh })).toBe(
      'Rang gelöscht.',
    );
  });

  it('choosing the default rank: the Leitung, a rank of the guild, below the Leitung', () => {
    const s = setup();
    s.officer(['ranks']);
    const set = (rank: unknown): Data => ({
      type: 'setGuildDefaultRank',
      rank,
    });
    refused(s, 'Free', set('none'), OUTSIDE);
    refused(s, 'Ada', set('none'), LEAD);
    refused(s, 'Lea', set('none'), NO_RANK);
    refused(
      s,
      'Lea',
      set(s.rank('Leitung')),
      'Die Leitung kann nicht der Standardrang sein.',
    );
    expect(s.run('Lea', set(s.rank('Offizier')))).toBe('Standardrang gesetzt.');
    // The rank of another guild is none of this guild's.
    const other = s.ctx.guilds.ranks(
      s.ctx.guilds.membership('u_Out')!.guild_id,
    )[1]!.id;
    refused(s, 'Lea', set(other), NO_RANK);
  });

  it('assigning: the right, then the member, then the rank, then its place and rights', () => {
    const s = setup();
    s.officer(['assign']);
    const assign = (uid: string, rank: unknown): Data => ({
      type: 'assignGuildRank',
      uid,
      rank,
    });
    refused(s, 'Free', assign('u_Bo', 'none'), OUTSIDE);
    refused(s, 'Bo', assign('nobody', 'none'), NO_RIGHT);
    refused(s, 'Ada', assign('nobody', 'none'), NO_MEMBER);
    refused(s, 'Ada', assign('u_Pia', 'none'), NO_MEMBER);
    refused(s, 'Ada', assign('u_Out', s.rank('Mitglied')), NO_MEMBER);
    refused(s, 'Ada', assign('u_Bo', 'none'), NO_RANK);
    // The member and the rank must be below the actor; the Leitung is first by the guild.
    refused(s, 'Ada', assign('u_Lea', s.rank('Mitglied')), LOWER);
    refused(s, 'Ada', assign('u_Bo', s.rank('Leitung')), LOWER);
    refused(s, 'Ada', assign('u_Bo', s.rank('Offizier')), LOWER);
    s.run('Lea', { type: 'createGuildRank', name: 'Neu' });
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: s.rank('Neu'),
      rights: ['remove'],
    });
    refused(s, 'Ada', assign('u_Bo', s.rank('Neu')), NO_RIGHT);
  });
});

describe('the order of the refusals of the chat actions (#214)', () => {
  const EMPTY = 'Die Nachricht ist leer.';
  const LONG = 'Die Nachricht darf höchstens 1.000 Zeichen haben.';
  const WAIT = 'Bitte warte kurz vor der nächsten Nachricht.';

  it('sending: the actor, the right, the text, then the pause', () => {
    const s = setup();
    const say = (who: string, text: unknown): Data => ({
      type: 'sendGuildChat',
      text,
    });
    refused(s, 'Free', say('Free', 'x'), OUTSIDE);
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: s.rank('Mitglied'),
      rights: ['chat-read'],
    });
    refused(s, 'Bo', say('Bo', ''), NO_RIGHT);
    s.ctx.clock.t += 3000;
    s.run('Lea', say('Lea', 'eins'));
    // The pause is asked last: a refused text names its own fault.
    refused(s, 'Lea', say('Lea', ''), EMPTY);
    refused(s, 'Lea', say('Lea', undefined), EMPTY);
    refused(s, 'Lea', say('Lea', 'x'.repeat(1001)), LONG);
    refused(s, 'Lea', say('Lea', 'zwei'), WAIT);
    s.ctx.clock.t += 2000;
    expect(s.run('Lea', say('Lea', 'zwei'))).toBeNull();
  });

  it('deleting: the right, then the message, then its kind, then its place', () => {
    const s = setup();
    s.ctx.clock.t += 3000;
    s.run('Lea', { type: 'sendGuildChat', text: 'von Lea' });
    const mine = s.ctx.guilds.chat(s.id).find((m) => m.kind === 'message')!.id;
    const event = s.ctx.guilds.chat(s.id).find((m) => m.kind !== 'message')!.id;
    const remove = (id: unknown): Data => ({ type: 'deleteGuildChat', id });
    s.officer(['chat-delete']);
    refused(s, 'Free', remove(mine), OUTSIDE);
    refused(s, 'Bo', remove(mine), NO_RIGHT);
    refused(s, 'Bo', remove(99999), NO_RIGHT);
    refused(s, 'Ada', remove(99999), 'Diese Nachricht gibt es nicht.');
    refused(s, 'Ada', remove(event), 'Ereignisse lassen sich nicht löschen.');
    refused(s, 'Ada', remove(mine), LOWER);
    // The message of another guild is none of this guild's.
    s.ctx.clock.t += 3000;
    s.run('Out', { type: 'sendGuildChat', text: 'fremd' });
    const foreign = s.ctx.guilds
      .chat(s.ctx.guilds.membership('u_Out')!.guild_id)
      .find((m) => m.kind === 'message')!.id;
    refused(s, 'Ada', remove(foreign), 'Diese Nachricht gibt es nicht.');
    expect(s.run('Lea', remove(mine))).toBe('Nachricht gelöscht.');
  });

  it('seeing: the actor, then the right „Chat lesen“', () => {
    const s = setup();
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: s.rank('Mitglied'),
      rights: [],
    });
    refused(s, 'Free', { type: 'seeGuildChat', id: 1 }, OUTSIDE);
    refused(s, 'Bo', { type: 'seeGuildChat', id: 1 }, NO_RIGHT);
    expect(s.run('Lea', { type: 'seeGuildChat', id: 1 })).toBeNull();
  });
});
