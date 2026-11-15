import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GuildRight } from '../../core/guild-ranks.ts';
import { deleteAccount } from '../delete-account.ts';
import {
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../test-helpers.ts';
import { deliverPush } from '../web-push.ts';
import { runAction } from './dispatch.ts';
import { adminGuildChat } from './guild-chat.ts';
import { guildState } from './guilds.ts';
import { GUILDS_OFF } from './round.ts';
import { stateFor } from './state.ts';

// The guild chat (#169). The messages are written out here, not imported,
// so a changed text is noticed.
const NO_RIGHT = 'Dazu fehlt deinem Rang das Recht.';
const LOWER = 'Das geht nur bei Rängen unter deinem.';
const OUTSIDE = 'Du bist in keiner Gilde.';
const NO_MESSAGE = 'Diese Nachricht gibt es nicht.';
const EMPTY = 'Die Nachricht ist leer.';
const LONG = 'Die Nachricht darf höchstens 1.000 Zeichen haben.';
const WAIT = 'Bitte warte kurz vor der nächsten Nachricht.';

type Data = Record<string, unknown>;

/**
 * A guild of Lea (Leitung) with the members Ada, Bo and Cy (Mitglied), the
 * applicant Pia and Out, who leads another guild.
 */
function setup() {
  const ctx = testCtx();
  for (const n of ['Lea', 'Ada', 'Bo', 'Cy', 'Pia', 'Out', 'Admin'])
    addUser(ctx, n, { admin: n === 'Admin' });
  const run = (who: string, d: Data) => runAction(ctx, `u_${who}`, d);
  run('Lea', { type: 'createGuild', tag: 'OR', name: 'Outer Rim' });
  const id = ctx.guilds.membership('u_Lea')!.guild_id;
  for (const n of ['Ada', 'Bo', 'Cy', 'Pia'])
    run(n, { type: 'applyToGuild', id });
  for (const n of ['Ada', 'Bo', 'Cy'])
    run('Lea', { type: 'reviewGuildApplication', uid: `u_${n}`, accept: true });
  run('Out', { type: 'createGuild', tag: 'XY', name: 'Xylon' });
  const other = ctx.guilds.membership('u_Out')!.guild_id;
  const rank = (name: string): string =>
    ctx.guilds.ranks(id).find((r) => r.name === name)!.id;
  /** Lea adds a rank right below the Leitung with `rights` and gives it to `who`. */
  const officer = (rights: GuildRight[], who = 'Ada', name = 'Offizier') => {
    run('Lea', { type: 'createGuildRank', name });
    const r = rank(name);
    while (ctx.guilds.rank(r)!.position > ctx.guilds.ranks(id)[1]!.position)
      run('Lea', { type: 'moveGuildRank', rank: r, up: true });
    run('Lea', { type: 'setGuildRankRights', rank: r, rights });
    run('Lea', { type: 'assignGuildRank', uid: `u_${who}`, rank: r });
    return r;
  };
  /** Sends a message 3 s after the previous one, so the rate limit stays out. */
  const say = (who: string, text: unknown) => {
    ctx.clock.t += 3000;
    return run(who, { type: 'sendGuildChat', text });
  };
  const chat = (who = 'Lea') =>
    guildState(ctx, `u_${who}`, {}).chat?.messages ?? null;
  const texts = (who = 'Lea') => chat(who)?.map((m) => m.text);
  const idOf = (text: string) =>
    ctx.guilds.chat(id).find((m) => m.text === text)!.id;
  const remove = (who: string, text: string | number) =>
    run(who, {
      type: 'deleteGuildChat',
      id: typeof text === 'number' ? text : idOf(text),
    });
  return {
    ctx,
    run,
    id,
    other,
    rank,
    officer,
    say,
    chat,
    texts,
    idOf,
    remove,
  };
}

describe('the rights of the chat (#169, D2)', () => {
  it('gives the Leitung every right and the default rank reading and writing', () => {
    const s = setup();
    expect(s.say('Lea', 'Willkommen')).toBeNull();
    expect(s.say('Ada', 'Danke')).toBeNull();
    expect(s.texts('Lea')).toEqual(['Willkommen', 'Danke']);
    expect(s.texts('Bo')).toEqual(['Willkommen', 'Danke']);
    expect(guildState(s.ctx, 'u_Lea', {}).chat).toMatchObject({
      read: true,
      write: true,
    });
    // The Leitung deletes; a Mitglied has no right to.
    expect(() => s.remove('Bo', 'Danke')).toThrow(NO_RIGHT);
    expect(s.remove('Lea', 'Danke')).toBe('Nachricht gelöscht.');
    expect(s.texts()).toEqual(['Willkommen']);
  });

  it('„Chat lesen“: only a rank with it gets the messages', () => {
    const s = setup();
    s.say('Lea', 'geheim');
    s.officer(['chat-write'], 'Ada', 'Schreiber');
    expect(guildState(s.ctx, 'u_Ada', {}).chat).toEqual({
      read: false,
      write: true,
      messages: [],
    });
    s.officer([], 'Bo', 'Stumm');
    expect(guildState(s.ctx, 'u_Bo', {}).chat).toBeNull();
    expect(s.texts('Cy')).toEqual(['geheim']);
    expect(
      JSON.stringify(stateFor(s.ctx, s.ctx.players.get('u_Bo')!)),
    ).not.toContain('geheim');
  });

  it('„Chat schreiben“: refused without it, also for a rank that reads', () => {
    const s = setup();
    s.officer(['chat-read'], 'Ada', 'Leser');
    expect(() => s.say('Ada', 'Hallo')).toThrow(NO_RIGHT);
    expect(s.texts('Ada')).toEqual([]);
    expect(s.say('Bo', 'Hallo')).toBeNull();
    expect(s.texts('Ada')).toEqual(['Hallo']);
  });

  it('„Chatnachrichten löschen“: allowed with it, refused without', () => {
    const s = setup();
    s.say('Bo', 'Spam');
    s.say('Cy', 'mehr Spam');
    s.officer(['chat-read', 'chat-delete'], 'Ada', 'Moderator');
    expect(s.chat('Ada')!.map((m) => m.delete)).toEqual([true, true]);
    expect(s.chat('Bo')!.map((m) => m.delete)).toEqual([false, false]);
    expect(() => s.remove('Bo', 'mehr Spam')).toThrow(NO_RIGHT);
    expect(s.remove('Ada', 'Spam')).toBe('Nachricht gelöscht.');
    expect(s.texts()).toEqual(['mehr Spam']);
  });

  it('refuses outsiders and applicants for every action and sends them no chat', () => {
    const s = setup();
    s.say('Lea', 'intern');
    const message = s.idOf('intern');
    for (const who of ['Pia', 'Admin']) {
      expect(() => s.say(who, 'Hallo'), who).toThrow(OUTSIDE);
      expect(() => s.remove(who, message), who).toThrow(OUTSIDE);
      expect(guildState(s.ctx, `u_${who}`, {}).chat, who).toBeNull();
      expect(
        JSON.stringify(stateFor(s.ctx, s.ctx.players.get(`u_${who}`)!)),
        who,
      ).not.toContain('intern');
    }
    // The Leitung of another guild sees only its own chat and cannot
    // delete a message of this one.
    expect(s.texts('Out')).toEqual([]);
    expect(() => s.remove('Out', message)).toThrow(NO_MESSAGE);
    expect(s.texts()).toEqual(['intern']);
  });
});

describe('deleting messages: the order of the ranks (#163 D4)', () => {
  it('deletes messages of lower ranks, of former members and its own, not of equals or higher', () => {
    const s = setup();
    const mod = s.officer(['chat-read', 'chat-write', 'chat-delete']);
    s.run('Lea', { type: 'assignGuildRank', uid: 'u_Cy', rank: mod });
    s.say('Lea', 'von Lea');
    s.say('Cy', 'von Cy');
    s.say('Bo', 'von Bo');
    s.say('Ada', 'von Ada');
    expect(s.chat('Ada')!.map((m) => [m.text, m.delete])).toEqual([
      ['von Lea', false],
      ['von Cy', false],
      ['von Bo', true],
      ['von Ada', true],
    ]);
    expect(() => s.remove('Ada', 'von Lea')).toThrow(LOWER);
    expect(() => s.remove('Ada', 'von Cy')).toThrow(LOWER);
    expect(s.remove('Ada', 'von Bo')).toBe('Nachricht gelöscht.');
    expect(s.remove('Ada', 'von Ada')).toBe('Nachricht gelöscht.');
    // Bo leaves: his messages count as a former member's, lowest of all.
    s.say('Bo', 'nochmal Bo');
    s.run('Bo', { type: 'leaveGuild' });
    expect(s.remove('Ada', 'nochmal Bo')).toBe('Nachricht gelöscht.');
    // The Leitung deletes every message.
    expect(s.remove('Lea', 'von Cy')).toBe('Nachricht gelöscht.');
    expect(s.remove('Lea', 'von Lea')).toBe('Nachricht gelöscht.');
    expect(s.texts()).toEqual([]);
  });

  it('refuses unknown messages and messages of another guild', () => {
    const s = setup();
    s.run('Out', { type: 'sendGuildChat', text: 'drüben' });
    const theirs = s.ctx.guilds.chat(s.other)[0]!.id;
    for (const id of [theirs, 999, -1, 'x', null, undefined, 1.5])
      expect(
        () => s.run('Lea', { type: 'deleteGuildChat', id }),
        String(id),
      ).toThrow(NO_MESSAGE);
    expect(s.ctx.guilds.chat(s.other)).toHaveLength(1);
  });

  it('refuses a member without the right before it learns whether a message exists', () => {
    const s = setup();
    s.run('Out', { type: 'sendGuildChat', text: 'drüben' });
    const theirs = s.ctx.guilds.chat(s.other)[0]!.id;
    expect(() => s.remove('Bo', theirs)).toThrow(NO_RIGHT);
    expect(() => s.remove('Bo', 999)).toThrow(NO_RIGHT);
  });
});

describe('messages (#169)', () => {
  it('stores plain text as written, without control characters, trimmed', () => {
    const s = setup();
    const xss = '<img src=x onerror=alert(1)> & "q" \'s\'';
    s.say('Ada', xss);
    s.say('Ada', '  zwei\nZeilen\t\u0007 ');
    expect(s.texts()).toEqual([xss, 'zweiZeilen']);
  });

  it('refuses an empty message and one longer than 1,000 characters', () => {
    const s = setup();
    for (const text of ['', '   ', '\n\t', null, undefined, 5, ['a'], { a: 1 }])
      expect(() => s.say('Ada', text), JSON.stringify(text)).toThrow(EMPTY);
    for (const text of [
      'a'.repeat(1001),
      '😀'.repeat(1001),
      'b'.repeat(70_000),
    ])
      expect(() => s.say('Ada', text)).toThrow(LONG);
    expect(s.texts()).toEqual([]);
    expect(s.say('Ada', 'a'.repeat(1000))).toBeNull();
    expect(s.say('Ada', '😀'.repeat(1000))).toBeNull();
    // Control characters do not count; the limit is after cleaning.
    expect(s.say('Ada', `${'c'.repeat(1000)}\u0000\u0000`)).toBeNull();
    expect(s.texts()!.map((t) => [...t].length)).toEqual([1000, 1000, 1000]);
  });

  it('allows one message per member every 2 seconds', () => {
    const s = setup();
    const send = (who: string) =>
      s.run(who, { type: 'sendGuildChat', text: `von ${who}` });
    s.ctx.clock.t = 10_000_000;
    expect(send('Ada')).toBeNull();
    s.ctx.clock.t += 1999;
    expect(() => send('Ada')).toThrow(WAIT);
    // Another member is not held up.
    expect(send('Bo')).toBeNull();
    // 2 s after the first: the refused one did not count.
    s.ctx.clock.t += 1;
    expect(send('Ada')).toBeNull();
    expect(s.texts()).toEqual(['von Ada', 'von Bo', 'von Ada']);
  });

  it('keeps the last 500 messages of each guild', () => {
    const s = setup();
    s.run('Out', { type: 'sendGuildChat', text: 'drüben' });
    for (let i = 1; i <= 503; i++) s.say(i % 2 ? 'Ada' : 'Bo', `Nr. ${i}`);
    const kept = s.texts()!;
    expect(kept).toHaveLength(500);
    expect(kept[0]).toBe('Nr. 4');
    expect(kept.at(-1)).toBe('Nr. 503');
    expect(s.texts('Out')).toEqual(['drüben']);
  });

  it('never keeps more than 500 messages and always the newest (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 560 }), (n) => {
        const ctx = testCtx();
        addUser(ctx, 'Lea');
        runAction(ctx, 'u_Lea', {
          type: 'createGuild',
          tag: 'OR',
          name: 'Outer Rim',
        });
        const id = ctx.guilds.membership('u_Lea')!.guild_id;
        for (let i = 0; i < n; i++) {
          ctx.clock.t += 2000;
          runAction(ctx, 'u_Lea', { type: 'sendGuildChat', text: `${i}` });
        }
        const kept = ctx.guilds.chat(id).map((m) => Number(m.text));
        expect(kept).toEqual(
          Array.from(
            { length: Math.min(n, 500) },
            (_, i) => n - Math.min(n, 500) + i,
          ),
        );
      }),
      { seed: 169, numRuns: 12 },
    );
  });
});

describe('leaving and deleted accounts (#169, D7)', () => {
  it('keeps the messages of a member who left or was removed as „ehemaliges Mitglied“', () => {
    const s = setup();
    s.officer(['remove', 'chat-read'], 'Ada');
    s.say('Bo', 'Bo war hier');
    s.say('Cy', 'Cy war hier');
    s.run('Bo', { type: 'leaveGuild' });
    s.run('Ada', { type: 'manageGuildMember', uid: 'u_Cy', transfer: false });
    expect(s.chat()!.map((m) => [m.name, m.text])).toEqual([
      [null, 'Bo war hier'],
      [null, 'Cy war hier'],
    ]);
    // Leaving ends the access.
    expect(() => s.say('Bo', 'zurück?')).toThrow(OUTSIDE);
    expect(guildState(s.ctx, 'u_Bo', {}).chat).toBeNull();
  });

  it('shows the current name of a member', () => {
    const s = setup();
    s.say('Ada', 'Hallo');
    expect(s.chat()!.map((m) => m.name)).toEqual(['Ada']);
  });

  it('anonymises the messages of a deleted account and deletes the chat of a guild its Leitung deleted', () => {
    const s = setup();
    s.say('Ada', 'von Ada');
    s.say('Lea', 'von Lea');
    s.run('Out', { type: 'sendGuildChat', text: 'drüben' });
    deleteAccount(s.ctx, s.ctx.players.get('u_Ada')!, 'secret1');
    expect(s.ctx.guilds.chat(s.id).map((m) => [m.author, m.text])).toEqual([
      [null, 'von Ada'],
      ['u_Lea', 'von Lea'],
    ]);
    expect(s.chat()!.map((m) => [m.name, m.text])).toEqual([
      [null, 'von Ada'],
      ['Lea', 'von Lea'],
    ]);
    expect(JSON.stringify(s.ctx.guilds.chat(s.id))).not.toContain('u_Ada');
    // The Leitung's account deletion dissolves its guild with the chat.
    deleteAccount(s.ctx, s.ctx.players.get('u_Lea')!, 'secret1');
    expect(s.ctx.guilds.chat(s.id)).toEqual([]);
    expect(s.ctx.guilds.chat(s.other)).toHaveLength(1);
  });
});

describe('the round and the guild switch (#169 D6, #191)', () => {
  it('deletes every chat at a new round with guilds on and keeps the guilds', () => {
    const s = setup();
    s.say('Ada', 'alte Runde');
    s.run('Out', { type: 'sendGuildChat', text: 'drüben' });
    s.run('Admin', { type: 'reset', guilds: true });
    expect(
      s.ctx.db.prepare('SELECT COUNT(*) FROM guild_chat').pluck().get(),
    ).toBe(0);
    expect(s.ctx.guilds.all()).toHaveLength(2);
    expect(s.texts()).toEqual([]);
    // The rate limit starts afresh too.
    expect(s.run('Ada', { type: 'sendGuildChat', text: 'neu' })).toBeNull();
  });

  it('deletes every chat with the guilds at a new round with guilds off', () => {
    const s = setup();
    s.say('Ada', 'alte Runde');
    s.run('Admin', { type: 'reset', guilds: false });
    expect(
      s.ctx.db.prepare('SELECT COUNT(*) FROM guild_chat').pluck().get(),
    ).toBe(0);
  });

  it('has no chat while guilds are off: refused, not in the state, not for the admin', () => {
    const s = setup();
    s.say('Ada', 'vorher');
    s.ctx.admin.putSettings([['roundGuilds', 0]]);
    expect(() => s.say('Ada', 'Hallo')).toThrow(GUILDS_OFF);
    expect(() => s.remove('Lea', 'vorher')).toThrow(GUILDS_OFF);
    expect(stateFor(s.ctx, s.ctx.players.get('u_Ada')!).guilds).toBeNull();
    expect(() => adminGuildChat(s.ctx, s.id)).toThrow(GUILDS_OFF);
    expect(s.ctx.guilds.chat(s.id)).toHaveLength(1);
  });
});

describe('push of a chat message (#169 D5, #192)', () => {
  it('queues the kind „guild-chat“ for every member who reads, not for the writer', () => {
    const s = setup();
    s.officer([], 'Cy', 'Stumm');
    for (const n of ['Lea', 'Ada', 'Bo', 'Cy', 'Pia', 'Out'])
      subscribePush(s.ctx, `u_${n}`);
    s.say('Ada', 'Hallo');
    expect(queuedPushes(s.ctx)).toEqual([
      { user: 'u_Lea', kind: 'guilds', topic: 'guild-chat' },
      { user: 'u_Bo', kind: 'guilds', topic: 'guild-chat' },
    ]);
    // A refused message pushes nothing.
    expect(() => s.say('Cy', 'Hallo')).toThrow(NO_RIGHT);
    expect(queuedPushes(s.ctx)).toHaveLength(2);
  });

  it('is delivered with the name of the kind and opens the guilds; a player who switched it off gets none', async () => {
    const s = setup();
    subscribePush(s.ctx, 'u_Lea');
    subscribePush(s.ctx, 'u_Bo');
    s.run('Bo', { type: 'pushOptions', off: ['guild-chat'] });
    s.say('Ada', 'Hallo');
    const sent: { endpoint: string; payload: unknown }[] = [];
    await deliverPush(s.ctx, (job, payload) => {
      sent.push({ endpoint: job.endpoint, payload: JSON.parse(payload) });
      return Promise.resolve();
    });
    expect(sent).toEqual([
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/u_Lea-1',
        payload: {
          title: 'Nachrichten im Gilden-Chat',
          view: 'guilds',
          tag: expect.any(String),
        },
      },
    ]);
    // The text of the message never leaves the server in a push.
    expect(JSON.stringify(sent)).not.toContain('Hallo');
  });
});

describe('the admin reads every guild chat (#169, D8)', () => {
  it('gets every message of any guild with the names of the members', () => {
    const s = setup();
    s.say('Ada', 'eins');
    s.say('Bo', 'zwei');
    s.run('Bo', { type: 'leaveGuild' });
    const read = adminGuildChat(s.ctx, s.id);
    expect(read.guild).toEqual({ id: s.id, tag: 'OR', name: 'Outer Rim' });
    expect(read.messages.map((m) => [m.name, m.text])).toEqual([
      ['Ada', 'eins'],
      [null, 'zwei'],
    ]);
    expect(read.messages[0]).toEqual({
      id: s.idOf('eins'),
      time: expect.any(Number),
      name: 'Ada',
      text: 'eins',
    });
    expect(() => adminGuildChat(s.ctx, 'none')).toThrow(
      'Diese Gilde gibt es nicht.',
    );
  });
});
