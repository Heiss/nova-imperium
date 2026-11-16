import { describe, expect, it } from 'vitest';
import { deleteAccount } from '../delete-account.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../test-helpers.ts';
import { deliverPush } from '../web-push.ts';
import { runAction } from './dispatch.ts';
import { adminGuildChat } from './guild-chat.ts';
import { guildState } from './guilds.ts';
import { addMoon } from './moons.ts';
import { GUILDS_OFF } from './round.ts';

// The event messages of the guild chat (#169 D3, D4; owner, 2026-11-14 and
// 2026-11-15) and the red mark on „Gilden“. The texts are written out here.
const NO_RIGHT = 'Dazu fehlt deinem Rang das Recht.';
const OUTSIDE = 'Du bist in keiner Gilde.';
const NO_EVENT_DELETE = 'Ereignisse lassen sich nicht löschen.';

type Data = Record<string, unknown>;

/**
 * Lea leads Outer Rim; Ada and Bo apply. Vex leads Xylon and has a fleet;
 * Pia is in no guild. Every player has a home planet: Lea at [1:1:5], Ada
 * at [1:27:11], Vex at [1:3:4], Pia at [1:4:4].
 */
function setup() {
  const ctx = testCtx();
  const home: Record<string, Data> = {
    Lea: { s: 1, p: 5 },
    Ada: { s: 27, p: 11 },
    Bo: { s: 2, p: 2 },
    Vex: { s: 3, p: 4, ships: { lf: 10, probe: 3, sc: 2 } },
    Pia: { s: 4, p: 4 },
  };
  for (const [n, at] of Object.entries(home)) {
    // Vex has fleet slots for several fleets.
    addUser(ctx, n, n === 'Vex' ? { research: { computer: 5 } } : {});
    // Enough points for every one not to be under noob protection.
    addPlanet(ctx, `u_${n}`, { g: 1, b: { metal: 15 }, ...at });
  }
  addUser(ctx, 'Admin', { admin: true });
  const run = (who: string, d: Data) => runAction(ctx, `u_${who}`, d);
  run('Lea', { type: 'createGuild', tag: 'OR', name: 'Outer Rim' });
  const id = ctx.guilds.membership('u_Lea')!.guild_id;
  run('Vex', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
  const other = ctx.guilds.membership('u_Vex')!.guild_id;
  for (const n of ['Ada', 'Bo']) run(n, { type: 'applyToGuild', id });
  const accept = (n: string) =>
    run('Lea', { type: 'reviewGuildApplication', uid: `u_${n}`, accept: true });
  /** The events of the chat as `who` reads them: kind, name, text. */
  const events = (who = 'Lea') =>
    (guildState(ctx, `u_${who}`, {}).chat?.messages ?? [])
      .filter((m) => m.kind !== 'message')
      .map((m) => [m.kind, m.name, m.text]);
  const rank = (name: string): string =>
    ctx.guilds.ranks(id).find((r) => r.name === name)!.id;
  const attack = (target: Data, mission = 'attack') =>
    run('Vex', {
      type: 'send',
      mission,
      ships: mission === 'spy' ? { probe: 1 } : { lf: 1 },
      to: { g: 1, ...target },
      pct: 10,
      cargo: {},
    });
  return { ctx, run, id, other, accept, events, rank, attack };
}

describe('member events (#169 D4; owner, 2026-11-15)', () => {
  it('writes joining, leaving and removal with the name of the member', () => {
    const s = setup();
    s.accept('Ada');
    s.accept('Bo');
    s.run('Ada', { type: 'leaveGuild' });
    s.run('Lea', { type: 'manageGuildMember', uid: 'u_Bo', transfer: false });
    expect(s.events()).toEqual([
      ['join', 'Ada', ''],
      ['join', 'Bo', ''],
      ['leave', 'Ada', ''],
      ['remove', 'Bo', ''],
    ]);
    // Written by the server: no author.
    expect(s.ctx.guilds.chat(s.id).map((m) => m.author)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('writes nothing for an application, its refusal or its withdrawal', () => {
    const s = setup();
    s.run('Lea', {
      type: 'reviewGuildApplication',
      uid: 'u_Ada',
      accept: false,
    });
    s.run('Bo', { type: 'leaveGuild' });
    s.run('Pia', { type: 'applyToGuild', id: s.id });
    expect(s.events()).toEqual([]);
    expect(s.ctx.guilds.chat(s.id)).toEqual([]);
  });

  it('writes a new rank: given, handed over and moved by a deleted rank', () => {
    const s = setup();
    s.accept('Ada');
    s.accept('Bo');
    s.run('Lea', { type: 'createGuildRank', name: 'Offizier' });
    const officer = s.rank('Offizier');
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: officer });
    // The same rank again is no change.
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: officer });
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Bo', rank: officer });
    s.run('Lea', { type: 'deleteGuildRank', rank: officer });
    expect(s.events().slice(2)).toEqual([
      ['rank', 'Ada', 'Offizier'],
      ['rank', 'Bo', 'Offizier'],
      ['rank', 'Ada', 'Mitglied'],
      ['rank', 'Bo', 'Mitglied'],
    ]);
    s.run('Lea', {
      type: 'manageGuildMember',
      uid: 'u_Bo',
      transfer: true,
      rank: s.rank('Mitglied'),
    });
    expect(s.events('Bo').slice(6)).toEqual([
      ['rank', 'Bo', 'Leitung'],
      ['rank', 'Lea', 'Mitglied'],
    ]);
  });

  it('keeps the names of members who left and shows a deleted account as „ehemaliges Mitglied“', () => {
    const s = setup();
    s.accept('Ada');
    s.accept('Bo');
    s.run('Ada', { type: 'leaveGuild' });
    // A member who left keeps the name in an event (owner: only a deleted name changes).
    expect(s.events().map((e) => e[1])).toEqual(['Ada', 'Bo', 'Ada']);
    deleteAccount(s.ctx, s.ctx.players.get('u_Ada')!, 'secret1');
    expect(s.events()).toEqual([
      ['join', null, ''],
      ['join', 'Bo', ''],
      ['leave', null, ''],
    ]);
    expect(JSON.stringify(s.ctx.guilds.chat(s.id))).not.toContain('u_Ada');
  });

  it('writes nothing when the Leitung dissolves the guild: the chat goes with it', () => {
    const s = setup();
    s.accept('Ada');
    s.run('Lea', { type: 'dissolveGuild', tag: 'OR' });
    expect(s.ctx.guilds.chat(s.id)).toEqual([]);
  });
});

describe('the attack event (#169 D3; owner, 2026-11-15)', () => {
  it('writes the target, the attacker, the member and the arrival at the launch', () => {
    const s = setup();
    s.accept('Ada');
    s.attack({ s: 27, p: 11 });
    const fleet = s.ctx.fleets.all()[0]!;
    const shown = guildState(s.ctx, 'u_Lea', {}).chat!.messages.at(-1);
    expect(shown).toEqual({
      id: expect.any(Number),
      time: s.ctx.now(),
      kind: 'attack',
      name: 'Ada',
      text: '[1:27:11]',
      attacker: 'Vex',
      arrival: fleet.arr,
      delete: false,
    });
    expect(fleet.arr).toBeGreaterThan(s.ctx.now());
    // The attacker's guild learns nothing; the outcome writes nothing.
    expect(s.ctx.guilds.chat(s.other)).toEqual([]);
    s.ctx.clock.t = fleet.arr + 1;
    s.run('Lea', { type: 'read' });
    expect(s.events().filter((e) => e[0] === 'attack')).toHaveLength(1);
  });

  it('writes nothing for other missions, for a player in no guild or an applicant', () => {
    const s = setup();
    s.accept('Ada');
    s.attack({ s: 27, p: 11 }, 'spy');
    s.attack({ s: 27, p: 11 }, 'transport');
    s.attack({ s: 4, p: 4 });
    s.attack({ s: 2, p: 2 });
    expect(s.ctx.fleets.all()).toHaveLength(4);
    expect(s.events().map((e) => e[0])).toEqual(['join']);
    expect(s.ctx.guilds.chat(s.other)).toEqual([]);
  });

  it('writes the same event for a Mondbruch at the moon of a member (#95; owner, 2026-11-16)', () => {
    const s = setup();
    s.accept('Ada');
    // Ada's moon; research keeps her out of the noob protection against the
    // Weltenbrecher of Vex.
    const ada = s.ctx.players.get('u_Ada')!;
    s.ctx.players.save({ ...ada, research: { energy: 12 } });
    addMoon(s.ctx, s.ctx.planets.get('p1_27_11')!, 1, s.ctx.now());
    const vex = s.ctx.planets.get('p1_3_4')!;
    s.ctx.planets.save({ ...vex, ships: { ...vex.ships, dstar: 1 } });
    s.run('Vex', {
      type: 'send',
      mission: 'moonbreak',
      ships: { dstar: 1 },
      to: { g: 1, s: 27, p: 11, kind: 'moon' },
      pct: 10,
      cargo: {},
    });
    const fleet = s.ctx.fleets.all()[0]!;
    expect(fleet).toMatchObject({ mission: 'moonbreak', to: 'm1_27_11' });
    const shown = guildState(s.ctx, 'u_Lea', {}).chat!.messages.at(-1);
    expect(shown).toEqual({
      id: expect.any(Number),
      time: s.ctx.now(),
      kind: 'attack',
      name: 'Ada',
      text: '[1:27:11]',
      attacker: 'Vex',
      arrival: fleet.arr,
      delete: false,
    });
    expect(s.ctx.guilds.chat(s.other)).toEqual([]);
  });

  it('shows a deleted attacker as „Unbekannt“: its name is gone', () => {
    const s = setup();
    s.accept('Ada');
    s.attack({ s: 27, p: 11 });
    s.run('Vex', { type: 'dissolveGuild', tag: 'XY' });
    deleteAccount(s.ctx, s.ctx.players.get('u_Vex')!, 'secret1');
    const shown = guildState(s.ctx, 'u_Lea', {}).chat!.messages.at(-1)!;
    expect(shown).toMatchObject({ kind: 'attack', name: 'Ada' });
    expect(shown).toHaveProperty('attacker', null);
    expect(JSON.stringify(s.ctx.guilds.chat(s.id))).not.toContain('u_Vex');
  });
});

describe('events in the chat (#169)', () => {
  it('cannot be deleted, not even by the Leitung', () => {
    const s = setup();
    s.accept('Ada');
    const event = s.ctx.guilds.chat(s.id)[0]!;
    // Only an attack carries an attacker and an arrival.
    expect(guildState(s.ctx, 'u_Lea', {}).chat!.messages[0]).toEqual({
      id: event.id,
      time: s.ctx.now(),
      kind: 'join',
      name: 'Ada',
      text: '',
      delete: false,
    });
    expect(() =>
      s.run('Lea', { type: 'deleteGuildChat', id: event.id }),
    ).toThrow(NO_EVENT_DELETE);
    expect(s.ctx.guilds.chat(s.id)).toHaveLength(1);
  });

  it('are read only with „Chat lesen“, and the admin reads them too', () => {
    const s = setup();
    s.accept('Ada');
    s.run('Lea', { type: 'createGuildRank', name: 'Stumm' });
    s.run('Lea', {
      type: 'assignGuildRank',
      uid: 'u_Ada',
      rank: s.rank('Stumm'),
    });
    expect(guildState(s.ctx, 'u_Ada', {}).chat).toBeNull();
    expect(s.events('Vex')).toEqual([]);
    expect(
      adminGuildChat(s.ctx, s.id).messages.map((m) => [m.kind, m.name, m.text]),
    ).toEqual([
      ['join', 'Ada', ''],
      ['rank', 'Ada', 'Stumm'],
    ]);
  });

  it('push „Gildenereignis“ of the kind „guild-events“ to the readers, not to the member or who caused it', async () => {
    const s = setup();
    s.accept('Bo');
    for (const n of ['Lea', 'Ada', 'Bo', 'Vex', 'Pia'])
      subscribePush(s.ctx, `u_${n}`);
    s.accept('Ada');
    expect(queuedPushes(s.ctx)).toEqual([
      { user: 'u_Bo', kind: 'guilds', topic: 'guild-events' },
    ]);
    s.attack({ s: 27, p: 11 });
    expect(queuedPushes(s.ctx).slice(1)).toEqual([
      { user: 'u_Lea', kind: 'guilds', topic: 'guild-events' },
      { user: 'u_Bo', kind: 'guilds', topic: 'guild-events' },
    ]);
    s.run('Lea', { type: 'pushOptions', off: ['guild-events'] });
    const sent: { endpoint: string; payload: unknown }[] = [];
    await deliverPush(s.ctx, (job, payload) => {
      sent.push({ endpoint: job.endpoint, payload: JSON.parse(payload) });
      return Promise.resolve();
    });
    expect(sent.map((p) => p.endpoint)).toEqual([
      'https://fcm.googleapis.com/fcm/send/u_Bo-1',
      'https://fcm.googleapis.com/fcm/send/u_Bo-1',
    ]);
    for (const p of sent)
      expect(p.payload).toEqual({
        title: 'Gildenereignis',
        view: 'guilds',
        tag: expect.any(String),
      });
    // Neither a name nor a place leaves the server in a push.
    for (const word of ['Ada', 'Vex', '27'])
      expect(JSON.stringify(sent)).not.toContain(word);
  });

  it('push nothing to a member without „Chat lesen“', () => {
    const s = setup();
    s.accept('Bo');
    s.run('Lea', { type: 'createGuildRank', name: 'Stumm' });
    s.run('Lea', {
      type: 'assignGuildRank',
      uid: 'u_Bo',
      rank: s.rank('Stumm'),
    });
    subscribePush(s.ctx, 'u_Bo');
    s.accept('Ada');
    s.attack({ s: 27, p: 11 });
    expect(queuedPushes(s.ctx)).toEqual([]);
  });
});

describe('the red mark on „Gilden“ (#169; owner, 2026-11-15)', () => {
  const unread = (s: ReturnType<typeof setup>, who: string) =>
    guildState(s.ctx, `u_${who}`, {}).chat?.unread;
  const newest = (s: ReturnType<typeof setup>) =>
    s.ctx.guilds.chat(s.id).at(-1)!.id;

  it('marks what is new since the last visit, per member', () => {
    const s = setup();
    expect(unread(s, 'Lea')).toBe(false);
    s.accept('Ada');
    // An event is new for the Leitung; the own message is never new.
    expect(unread(s, 'Lea')).toBe(true);
    s.run('Lea', { type: 'seeGuildChat', id: newest(s) });
    expect(unread(s, 'Lea')).toBe(false);
    s.ctx.clock.t += 3000;
    s.run('Lea', { type: 'sendGuildChat', text: 'Hallo' });
    expect(unread(s, 'Lea')).toBe(false);
    expect(unread(s, 'Ada')).toBe(true);
    s.ctx.clock.t += 3000;
    s.run('Ada', { type: 'sendGuildChat', text: 'Hi' });
    expect(unread(s, 'Lea')).toBe(true);
    // Ada saw up to the message of Lea: her own later one is not new.
    s.run('Ada', { type: 'seeGuildChat', id: newest(s) - 1 });
    expect(unread(s, 'Ada')).toBe(false);
    expect(unread(s, 'Lea')).toBe(true);
  });

  it('stores at most the newest message of the guild and never goes back', () => {
    const s = setup();
    // An empty chat: nothing to see.
    expect(s.run('Lea', { type: 'seeGuildChat', id: 5 })).toBeNull();
    expect(s.ctx.guilds.membership('u_Lea')!.chat_seen).toBe(0);
    s.accept('Ada');
    const last = newest(s);
    expect(s.run('Ada', { type: 'seeGuildChat', id: 1e9 })).toBeNull();
    expect(s.ctx.guilds.membership('u_Ada')!.chat_seen).toBe(last);
    for (const id of [0, -5, 'x', null])
      s.run('Ada', { type: 'seeGuildChat', id });
    expect(s.ctx.guilds.membership('u_Ada')!.chat_seen).toBe(last);
    // The chat of another guild does not count.
    s.ctx.clock.t += 3000;
    s.run('Vex', { type: 'sendGuildChat', text: 'drüben' });
    s.run('Ada', { type: 'seeGuildChat', id: 1e9 });
    expect(s.ctx.guilds.membership('u_Ada')!.chat_seen).toBe(last);
  });

  it('needs „Chat lesen“ and a membership, and follows the guild switch', () => {
    const s = setup();
    s.accept('Ada');
    expect(() => s.run('Pia', { type: 'seeGuildChat', id: 1 })).toThrow(
      OUTSIDE,
    );
    expect(() => s.run('Bo', { type: 'seeGuildChat', id: 1 })).toThrow(OUTSIDE);
    s.run('Lea', { type: 'createGuildRank', name: 'Schreiber' });
    const writer = s.rank('Schreiber');
    s.run('Lea', {
      type: 'setGuildRankRights',
      rank: writer,
      rights: ['chat-write'],
    });
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Ada', rank: writer });
    expect(() => s.run('Ada', { type: 'seeGuildChat', id: 1 })).toThrow(
      NO_RIGHT,
    );
    // A rank that only writes gets no messages and no mark.
    expect(unread(s, 'Ada')).toBe(false);
    s.ctx.admin.putSettings([['roundGuilds', 0]]);
    expect(() => s.run('Lea', { type: 'seeGuildChat', id: 1 })).toThrow(
      GUILDS_OFF,
    );
  });

  it('starts from nothing seen in a new guild', () => {
    const s = setup();
    s.accept('Ada');
    s.run('Ada', { type: 'seeGuildChat', id: newest(s) });
    s.run('Ada', { type: 'leaveGuild' });
    s.run('Ada', { type: 'applyToGuild', id: s.other });
    s.run('Vex', {
      type: 'reviewGuildApplication',
      uid: 'u_Ada',
      accept: true,
    });
    expect(s.ctx.guilds.membership('u_Ada')!.chat_seen).toBe(0);
    expect(unread(s, 'Ada')).toBe(true);
  });
});
