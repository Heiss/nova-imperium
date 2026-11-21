import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PM_HISTORY, PM_PAGE } from '../../core/private-messages.ts';
import { deleteAccount } from '../delete-account.ts';
import {
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
  type TestCtx,
} from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import {
  adminMessageReports,
  privateMessageState,
} from './private-messages.ts';
import { stateFor } from './state.ts';

// The private messages (#226, owner, 2026-11-21). The messages are written
// out here, not imported, so a changed text is noticed.
const EMPTY = 'Die Nachricht ist leer.';
const LONG = 'Die Nachricht darf höchstens 1.000 Zeichen haben.';
const WAIT = 'Bitte warte kurz vor der nächsten Nachricht.';
const REFUSED = 'Dieser Spieler nimmt keine Nachrichten von dir an.';
const UNKNOWN = 'Spieler nicht gefunden.';
const SELF = 'Du kannst dir nicht selbst schreiben.';
const GONE = 'Diese Nachricht gibt es nicht.';

type Data = Record<string, unknown>;

/** Anna, Bert, Cora and Dirk; Admin reads the reports. */
function setup() {
  const ctx = testCtx();
  for (const n of ['Anna', 'Bert', 'Cora', 'Dirk', 'Admin'])
    addUser(ctx, n, { admin: n === 'Admin' });
  const run = (who: string, d: Data) => runAction(ctx, `u_${who}`, d);
  /** `who` writes to `to`, 3 s after the previous message, so the rate limit stays out. */
  const say = (who: string, to: unknown, text: unknown) => {
    ctx.clock.t += 3000;
    return run(who, { type: 'sendPrivateMessage', name: to, text });
  };
  const view = (who: string) => privateMessageState(ctx, `u_${who}`);
  const texts = (who: string, other: string) =>
    view(who)
      .conversations.find((c) => c.with === other)
      ?.messages.map((m) => m.text);
  return { ctx, run, say, view, texts };
}

describe('sending', () => {
  it('lets two unrelated players write and reply, and shows each the conversation', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'Hallo Bert');
    s.say('Bert', 'Anna', 'Hallo Anna');
    expect(s.texts('Anna', 'Bert')).toEqual(['Hallo Bert', 'Hallo Anna']);
    expect(s.texts('Bert', 'Anna')).toEqual(['Hallo Bert', 'Hallo Anna']);
    const anna = s.view('Anna').conversations[0]!;
    expect(anna.messages.map((m) => m.mine)).toEqual([true, false]);
    expect(anna.unread).toBe(1);
    expect(s.view('Bert').conversations[0]!.unread).toBe(1);
  });

  it('takes the sender from the session, never from the input', () => {
    const s = setup();
    s.run('Anna', {
      type: 'sendPrivateMessage',
      name: 'Bert',
      text: 'Hi',
      sender: 'u_Cora',
      from: 'u_Cora',
      uid: 'u_Cora',
    });
    expect(s.ctx.privateMessages.visibleTo('u_Bert')[0]!.sender).toBe('u_Anna');
    expect(s.view('Cora').conversations).toEqual([]);
  });

  it('refuses an unknown recipient, oneself, an empty and a long text', () => {
    const s = setup();
    expect(() => s.say('Anna', 'Nobody', 'x')).toThrow(UNKNOWN);
    expect(() => s.say('Anna', 42, 'x')).toThrow(UNKNOWN);
    expect(() => s.say('Anna', 'Anna', 'x')).toThrow(SELF);
    expect(() => s.say('Anna', 'Bert', '')).toThrow(EMPTY);
    expect(() => s.say('Anna', 'Bert', '  \n ')).toThrow(EMPTY);
    expect(() => s.say('Anna', 'Bert', 7)).toThrow(EMPTY);
    expect(() => s.say('Anna', 'Bert', 'a'.repeat(1001))).toThrow(LONG);
    expect(() => s.say('Anna', 'Bert', 'a'.repeat(10_000))).toThrow(LONG);
    s.say('Anna', 'Bert', 'a'.repeat(1000));
    s.say('Anna', 'Bert', '😀'.repeat(1000));
    expect(s.view('Bert').conversations[0]!.messages).toHaveLength(2);
  });

  it('stores plain text as written, without control characters', () => {
    const s = setup();
    s.say('Anna', 'Bert', '  <script>alert(1)</script>\u0007 & "x"  ');
    expect(s.texts('Bert', 'Anna')).toEqual([
      '<script>alert(1)</script> & "x"',
    ]);
  });

  it('holds a sender for 2 seconds, and a refused message does not count', () => {
    const s = setup();
    s.run('Anna', { type: 'sendPrivateMessage', name: 'Bert', text: 'eins' });
    expect(() =>
      s.run('Anna', { type: 'sendPrivateMessage', name: 'Bert', text: 'zwei' }),
    ).toThrow(WAIT);
    // The limit is per sender, not per recipient.
    expect(() =>
      s.run('Anna', { type: 'sendPrivateMessage', name: 'Cora', text: 'zwei' }),
    ).toThrow(WAIT);
    s.run('Bert', { type: 'sendPrivateMessage', name: 'Anna', text: 'ich' });
    s.ctx.clock.t += 1999;
    expect(() =>
      s.run('Anna', { type: 'sendPrivateMessage', name: 'Bert', text: 'zwei' }),
    ).toThrow(WAIT);
    s.ctx.clock.t += 1;
    s.run('Anna', { type: 'sendPrivateMessage', name: 'Bert', text: 'zwei' });
    expect(s.texts('Bert', 'Anna')).toEqual(['eins', 'ich', 'zwei']);
    // An empty message is refused before it counts.
    expect(() =>
      s.run('Anna', { type: 'sendPrivateMessage', name: 'Bert', text: '' }),
    ).toThrow(EMPTY);
  });

  it('keeps the last 500 messages of a conversation, and no other conversation loses any', () => {
    const s = setup();
    s.say('Anna', 'Cora', 'bleibt');
    for (let i = 0; i < PM_HISTORY + 3; i++)
      s.say(i % 2 ? 'Bert' : 'Anna', i % 2 ? 'Anna' : 'Bert', `m${i}`);
    // The state carries only the newest page (Q27); the 500 kept are in the table.
    const kept = s.ctx.privateMessages
      .visibleTo('u_Anna')
      .filter((m) => m.sender !== 'u_Anna' || m.recipient !== 'u_Cora')
      .map((m) => m.text);
    expect(kept).toHaveLength(PM_HISTORY);
    expect(kept[0]).toBe('m3');
    expect(kept.at(-1)).toBe(`m${PM_HISTORY + 2}`);
    expect(s.texts('Anna', 'Cora')).toEqual(['bleibt']);
  });

  it('keeps at most 500 whatever the order of the senders (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }),
        (who) => {
          const ctx = testCtx();
          addUser(ctx, 'Anna');
          addUser(ctx, 'Bert');
          who.forEach((a, i) =>
            ctx.privateMessages.add(
              a ? 'u_Anna' : 'u_Bert',
              a ? 'u_Bert' : 'u_Anna',
              i,
              `m${i}`,
            ),
          );
          expect(ctx.privateMessages.visibleTo('u_Anna')).toHaveLength(
            who.length,
          );
        },
      ),
      { numRuns: 20 },
    );
  });

  it('works while guilds are off and in vacation mode (owner, 2026-11-21)', () => {
    const s = setup();
    s.run('Admin', { type: 'reset', guilds: false });
    s.ctx.db
      .prepare('UPDATE users SET vacation = ? WHERE id = ?')
      .run(1, 'u_Anna');
    s.say('Anna', 'Bert', 'aus dem Urlaub');
    s.say('Bert', 'Anna', 'Antwort');
    expect(s.texts('Anna', 'Bert')).toEqual(['aus dem Urlaub', 'Antwort']);
    s.run('Anna', { type: 'readPrivateMessages', name: 'Bert' });
    expect(s.view('Anna').conversations[0]!.unread).toBe(0);
  });
});

/** The table `table` as rows. */
const rows = (ctx: TestCtx, table: string): unknown[] =>
  ctx.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();

describe('paging (Q27, coordinator, 2026-11-21)', () => {
  /** Anna and Bert exchange `n` messages `m0` to `m<n-1>`, written straight to the table (no rate limit). */
  const fill = (s: ReturnType<typeof setup>, n: number) => {
    for (let i = 0; i < n; i++)
      s.ctx.privateMessages.add(
        i % 3 ? 'u_Anna' : 'u_Bert',
        i % 3 ? 'u_Bert' : 'u_Anna',
        i,
        `m${i}`,
      );
  };
  const older = (s: ReturnType<typeof setup>, who: string, before: unknown) =>
    s.run(who, { type: 'olderPrivateMessages', before }) as unknown as {
      data: { older: { id: number; text: string }[]; more: boolean };
    };

  it('holds at most 50 messages per conversation in the state, the newest, with the unread count of all', () => {
    const s = setup();
    fill(s, 130);
    s.say('Anna', 'Cora', 'andere Unterhaltung');
    const bert = s.view('Bert').conversations[0]!;
    expect(PM_PAGE).toBe(50);
    expect(bert.messages).toHaveLength(50);
    expect(bert.messages.map((m) => m.text)).toEqual(
      Array.from({ length: 50 }, (_, i) => `m${80 + i}`),
    );
    expect(bert.more).toBe(true);
    // Unread is counted over all 130 messages, not over the page.
    const received = Array.from({ length: 130 }, (_, i) => i).filter(
      (i) => i % 3 === 0,
    ).length;
    expect(
      s.view('Anna').conversations.find((c) => c.with === 'Bert')!.unread,
    ).toBe(received);
    expect(s.view('Anna').conversations.map((c) => c.messages.length)).toEqual([
      1, 50,
    ]);
    // Whatever the number, no conversation carries more than a page.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 120 }), (n) => {
        const t = setup();
        fill(t, n);
        const c = t.view('Anna').conversations[0];
        expect(c?.messages.length ?? 0).toBe(Math.min(n, PM_PAGE));
        expect(c?.more ?? false).toBe(n > PM_PAGE);
      }),
      { numRuns: 15 },
    );
  });

  it('loads the older pages in order, with no gap and no duplicate, down to the first message', () => {
    const s = setup();
    fill(s, 137);
    // A message Anna deleted from her own view is no part of her pages.
    const hidden = s.ctx.privateMessages
      .visibleTo('u_Anna')
      .find((m) => m.text === 'm60')!;
    s.run('Anna', { type: 'deletePrivateMessage', id: hidden.id });
    const shown = s.view('Anna').conversations[0]!;
    let all = shown.messages.map((m) => ({ id: m.id, text: m.text }));
    let more = shown.more;
    let pages = 0;
    while (more) {
      const page = older(s, 'Anna', all[0]!.id).data;
      expect(page.older.length).toBeGreaterThan(0);
      expect(page.older.length).toBeLessThanOrEqual(PM_PAGE);
      all = [...page.older.map((m) => ({ id: m.id, text: m.text })), ...all];
      more = page.more;
      pages++;
    }
    expect(pages).toBe(2);
    const expected = s.ctx.privateMessages
      .visibleTo('u_Anna')
      .map((m) => ({ id: m.id, text: m.text }));
    expect(all).toEqual(expected);
    expect(all).toHaveLength(136);
    expect(all.map((m) => m.text)).not.toContain('m60');
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
    const ids = all.map((m) => m.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('says whether more exist exactly at the page borders', () => {
    const s = setup();
    fill(s, PM_PAGE * 2);
    const first = s.view('Anna').conversations[0]!.messages[0]!.id;
    expect(older(s, 'Anna', first).data.older).toHaveLength(PM_PAGE);
    expect(older(s, 'Anna', first).data.more).toBe(false);
    // One message more than two pages: the first page is full and one is left.
    s.ctx.privateMessages.add('u_Anna', 'u_Bert', 999, 'neu');
    const next = s.view('Anna').conversations[0]!.messages[0]!.id;
    expect(older(s, 'Anna', next).data.older).toHaveLength(PM_PAGE);
    expect(older(s, 'Anna', next).data.more).toBe(true);
  });

  it('loads only the one conversation of the message, never one with another player', () => {
    const s = setup();
    fill(s, 80);
    for (let i = 0; i < 70; i++)
      s.ctx.privateMessages.add('u_Anna', 'u_Cora', 1000 + i, `c${i}`);
    const first = s.view('Anna').conversations.find((c) => c.with === 'Bert')!
      .messages[0]!.id;
    const page = older(s, 'Anna', first).data.older;
    expect(page.length).toBeGreaterThan(0);
    expect(page.every((m) => m.text.startsWith('m'))).toBe(true);
  });

  it('pages the conversation with a deleted account too', () => {
    const s = setup();
    fill(s, 70);
    deleteAccount(s.ctx, s.ctx.players.get('u_Anna')!, 'secret1');
    const c = s.view('Bert').conversations[0]!;
    expect(c).toMatchObject({ with: null, more: true });
    expect(older(s, 'Bert', c.messages[0]!.id).data.older).toHaveLength(20);
  });

  it('refuses a message of a foreign conversation exactly like an unknown one, and leaks nothing', () => {
    const s = setup();
    fill(s, 80);
    s.say('Cora', 'Dirk', 'GEHEIM-CORA-DIRK');
    const bertId = s.view('Anna').conversations[0]!.messages[10]!.id;
    const own = s.view('Cora').conversations[0]!.messages[0]!.id;
    const answers = new Set<string>();
    // Cora and Dirk have conversations of their own, but not the one asked for.
    for (const who of ['Cora', 'Dirk', 'Admin'])
      for (const before of [bertId, 9999, -1, 0, 1.5, '1', null, {}, [], NaN]) {
        try {
          older(s, who, before);
          expect.unreachable(`${who} ${JSON.stringify(before)}`);
        } catch (error) {
          answers.add((error as Error).message);
        }
      }
    expect([...answers]).toEqual([GONE]);
    // The same answer for a message the player hid, and a message of its other conversation.
    s.run('Anna', { type: 'deletePrivateMessage', id: bertId });
    expect(() => older(s, 'Anna', bertId)).toThrow(GONE);
    expect(() => older(s, 'Anna', own)).toThrow(GONE);
    // The own conversation pages; a SQL fragment as the id is no id.
    expect(() => older(s, 'Cora', '1 OR 1=1')).toThrow(GONE);
    expect(() => older(s, 'Cora', own)).not.toThrow();
  });

  it('writes nothing: reading a page changes no message and no mark', () => {
    const s = setup();
    fill(s, 90);
    const before = JSON.stringify(rows(s.ctx, 'private_messages'));
    const first = s.view('Anna').conversations[0]!.messages[0]!.id;
    older(s, 'Anna', first);
    expect(JSON.stringify(rows(s.ctx, 'private_messages'))).toBe(before);
  });
});

describe('the block list and „only friends“', () => {
  it('refuses a blocked sender with the neutral text, and lets everyone else through', () => {
    const s = setup();
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    expect(() => s.say('Anna', 'Bert', 'Hallo')).toThrow(REFUSED);
    s.say('Cora', 'Bert', 'Hallo');
    // The blocker may still write to the blocked player.
    s.say('Bert', 'Anna', 'Ich darf');
    expect(s.texts('Bert', 'Cora')).toEqual(['Hallo']);
    expect(s.texts('Bert', 'Anna')).toEqual(['Ich darf']);
    s.run('Bert', { type: 'unblockPlayer', name: 'Anna' });
    s.say('Anna', 'Bert', 'Wieder da');
    expect(s.view('Bert').blocked).toEqual([]);
  });

  it('does nothing to earlier messages: only a future send is refused (Q29)', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'VOR-DER-SPERRE');
    s.say('Bert', 'Anna', 'ANTWORT-VOR-DER-SPERRE');
    const table = JSON.stringify(rows(s.ctx, 'private_messages'));
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    // Nothing of the conversation moved: not a row, not a mark, in either view.
    expect(JSON.stringify(rows(s.ctx, 'private_messages'))).toBe(table);
    const both = ['VOR-DER-SPERRE', 'ANTWORT-VOR-DER-SPERRE'];
    expect(s.texts('Anna', 'Bert')).toEqual(both);
    expect(s.texts('Bert', 'Anna')).toEqual(both);
    // The blocker can still report an earlier message of the blocked player.
    const first = s.view('Bert').conversations[0]!.messages[0]!.id;
    expect(s.run('Bert', { type: 'reportPrivateMessage', id: first })).toBe(
      'Nachricht gemeldet.',
    );
    expect(() => s.say('Anna', 'Bert', 'NACH-DER-SPERRE')).toThrow(REFUSED);
    expect(s.texts('Bert', 'Anna')).toEqual(both);
    // Lifting the block changes no earlier message either.
    s.run('Bert', { type: 'unblockPlayer', name: 'Anna' });
    expect(s.texts('Anna', 'Bert')).toEqual(both);
  });

  it('gives the same refusal for „blocked“ and „only friends“, so the sender cannot tell', () => {
    const s = setup();
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    s.run('Cora', { type: 'privateMessageOptions', friendsOnly: true });
    let blocked = '';
    let friendsOnly = '';
    try {
      s.say('Anna', 'Bert', 'x');
    } catch (error) {
      blocked = (error as Error).message;
    }
    try {
      s.say('Anna', 'Cora', 'x');
    } catch (error) {
      friendsOnly = (error as Error).message;
    }
    expect(blocked).toBe(REFUSED);
    expect(friendsOnly).toBe(blocked);
    expect(REFUSED.toLowerCase()).not.toMatch(/block|sperr|freund/);
  });

  it('refuses a blocked sender also while it is a friend', () => {
    const s = setup();
    s.run('Anna', { type: 'requestFriend', name: 'Bert' });
    s.run('Bert', { type: 'answerFriend', uid: 'u_Anna', accept: true });
    s.say('Anna', 'Bert', 'Freund');
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    expect(() => s.say('Anna', 'Bert', 'x')).toThrow(REFUSED);
  });

  it('lets only friends write to a player who switched it on, and it is off by default', () => {
    const s = setup();
    expect(s.view('Bert').friendsOnly).toBe(false);
    s.say('Cora', 'Bert', 'frei');
    expect(
      s.run('Bert', { type: 'privateMessageOptions', friendsOnly: true }),
    ).toBe('Gespeichert.');
    expect(s.view('Bert').friendsOnly).toBe(true);
    expect(() => s.say('Cora', 'Bert', 'x')).toThrow(REFUSED);
    s.run('Anna', { type: 'requestFriend', name: 'Bert' });
    expect(() => s.say('Anna', 'Bert', 'x')).toThrow(REFUSED);
    s.run('Bert', { type: 'answerFriend', uid: 'u_Anna', accept: true });
    s.say('Anna', 'Bert', 'Freund');
    // Ending the friendship ends the right to write; a switch off lets all in.
    s.run('Bert', { type: 'removeFriend', uid: 'u_Anna' });
    expect(() => s.say('Anna', 'Bert', 'x')).toThrow(REFUSED);
    s.run('Bert', { type: 'privateMessageOptions', friendsOnly: false });
    s.say('Anna', 'Bert', 'wieder');
    // Only a real `true` switches it on.
    s.run('Bert', { type: 'privateMessageOptions', friendsOnly: 'true' });
    expect(s.view('Bert').friendsOnly).toBe(false);
  });

  it('does not let a player write to itself through „friends only“, and refuses blocking oneself or an unknown player', () => {
    const s = setup();
    expect(() => s.run('Anna', { type: 'blockPlayer', name: 'Anna' })).toThrow(
      SELF,
    );
    expect(() =>
      s.run('Anna', { type: 'blockPlayer', name: 'Nobody' }),
    ).toThrow(UNKNOWN);
    expect(() =>
      s.run('Anna', { type: 'unblockPlayer', name: 'Nobody' }),
    ).toThrow(UNKNOWN);
  });

  it('shows the block list to its owner only, by name', () => {
    const s = setup();
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    expect(s.view('Bert').blocked).toEqual(['Anna']);
    expect(s.view('Anna').blocked).toEqual([]);
    expect(
      JSON.stringify(stateFor(s.ctx, s.ctx.players.get('u_Anna')!)),
    ).not.toContain('blocked":["Anna');
  });
});

describe('reading, deleting and the unread mark', () => {
  it('marks only the own received messages of one conversation as read', () => {
    const s = setup();
    s.say('Anna', 'Cora', 'a');
    s.say('Bert', 'Cora', 'b');
    s.run('Cora', { type: 'readPrivateMessages', name: 'Anna' });
    const unread = (who: string) =>
      Object.fromEntries(
        s.view(who).conversations.map((c) => [c.with, c.unread]),
      );
    expect(unread('Cora')).toEqual({ Anna: 0, Bert: 1 });
    // A third player cannot mark the messages of others.
    s.run('Dirk', { type: 'readPrivateMessages', name: 'Anna' });
    s.run('Anna', { type: 'readPrivateMessages', name: 'Cora' });
    expect(unread('Cora')).toEqual({ Anna: 0, Bert: 1 });
    s.run('Cora', { type: 'readPrivateMessages', name: 'Bert' });
    expect(unread('Cora')).toEqual({ Anna: 0, Bert: 0 });
    expect(() =>
      s.run('Cora', { type: 'readPrivateMessages', name: 'Nobody' }),
    ).toThrow(UNKNOWN);
  });

  it('deletes a message from the own view only; the other side keeps it', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'eins');
    s.say('Bert', 'Anna', 'zwei');
    const id = s.view('Anna').conversations[0]!.messages[0]!.id;
    s.run('Anna', { type: 'deletePrivateMessage', id });
    expect(s.texts('Anna', 'Bert')).toEqual(['zwei']);
    expect(s.texts('Bert', 'Anna')).toEqual(['eins', 'zwei']);
    // Deleted twice from the own view: not there any more.
    expect(() => s.run('Anna', { type: 'deletePrivateMessage', id })).toThrow(
      GONE,
    );
    // Once both sides deleted it, the row is gone.
    s.run('Bert', { type: 'deletePrivateMessage', id });
    expect(s.ctx.privateMessages.get(id)).toBeUndefined();
  });

  it('refuses to delete a message of a conversation one is not part of, and says nothing about it', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'geheim');
    const id = s.view('Anna').conversations[0]!.messages[0]!.id;
    expect(() => s.run('Cora', { type: 'deletePrivateMessage', id })).toThrow(
      GONE,
    );
    expect(() =>
      s.run('Cora', { type: 'deletePrivateMessage', id: 9999 }),
    ).toThrow(GONE);
    expect(() =>
      s.run('Cora', { type: 'deletePrivateMessage', id: 'x' }),
    ).toThrow(GONE);
    expect(s.texts('Anna', 'Bert')).toEqual(['geheim']);
    expect(s.texts('Bert', 'Anna')).toEqual(['geheim']);
  });

  it('deletes a whole conversation from the own view only', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'eins');
    s.say('Bert', 'Anna', 'zwei');
    s.say('Anna', 'Cora', 'drei');
    s.run('Anna', { type: 'deletePrivateConversation', name: 'Bert' });
    expect(s.view('Anna').conversations.map((c) => c.with)).toEqual(['Cora']);
    expect(s.texts('Bert', 'Anna')).toEqual(['eins', 'zwei']);
    // A new message starts the conversation again, without the deleted ones.
    s.say('Bert', 'Anna', 'vier');
    expect(s.texts('Anna', 'Bert')).toEqual(['vier']);
  });
});

describe('what nobody else can get (privacy)', () => {
  it('gives a player nothing of a conversation it is not part of', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEHEIMTEXT-1');
    s.say('Bert', 'Anna', 'GEHEIMTEXT-2');
    s.run('Anna', { type: 'blockPlayer', name: 'Dirk' });
    s.run('Anna', { type: 'privateMessageOptions', friendsOnly: true });
    for (const who of ['Cora', 'Dirk', 'Admin']) {
      const state = JSON.stringify(
        stateFor(s.ctx, s.ctx.players.get(`u_${who}`)!),
      );
      expect(state).not.toContain('GEHEIMTEXT');
      expect(s.view(who).conversations).toEqual([]);
      expect(s.view(who).friendsOnly).toBe(false);
      expect(s.view(who).blocked).toEqual([]);
    }
    // Not even the recipients: the other players' state names no conversation of Anna.
    expect(
      JSON.stringify(stateFor(s.ctx, s.ctx.players.get('u_Cora')!)),
    ).not.toContain('conversations":[{');
  });

  it('gives the unread state of a conversation to its two players only', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'hallo');
    expect(s.view('Bert').conversations[0]!.unread).toBe(1);
    expect(s.view('Anna').conversations[0]!.unread).toBe(0);
    for (const who of ['Cora', 'Dirk', 'Admin'])
      expect(s.view(who).conversations).toEqual([]);
  });

  it('is in the state of the player and in no public part of it', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEHEIMTEXT');
    const state = stateFor(s.ctx, s.ctx.players.get('u_Anna')!) as Record<
      string,
      unknown
    >;
    expect(state.privateMessages).toBeDefined();
    const rest = { ...state, privateMessages: null };
    expect(JSON.stringify(rest)).not.toContain('GEHEIMTEXT');
  });
});

describe('the push', () => {
  it('queues the kind with a text without the message, to the recipient only', () => {
    const s = setup();
    subscribePush(s.ctx, 'u_Anna');
    subscribePush(s.ctx, 'u_Bert');
    s.say('Anna', 'Bert', 'GEHEIMTEXT');
    expect(queuedPushes(s.ctx)).toEqual([
      { user: 'u_Bert', kind: 'messages', topic: 'private-messages' },
    ]);
    const body = s.ctx.db.prepare('SELECT body FROM push_jobs').pluck().all();
    expect(body).toEqual(['Neue persönliche Nachricht']);
  });

  it('queues none for a refused message', () => {
    const s = setup();
    subscribePush(s.ctx, 'u_Bert');
    s.run('Bert', { type: 'blockPlayer', name: 'Anna' });
    expect(() => s.say('Anna', 'Bert', 'x')).toThrow(REFUSED);
    expect(queuedPushes(s.ctx)).toEqual([]);
  });

  it('can be switched off in the push settings, and the kind is on by default', () => {
    const s = setup();
    expect(s.ctx.db.prepare('SELECT * FROM push_off').all()).toEqual([]);
    expect(
      s.run('Bert', { type: 'pushOptions', off: ['private-messages'] }),
    ).toBe('Gespeichert.');
    expect(
      s.ctx.db.prepare('SELECT topic FROM push_off').pluck().all(),
    ).toEqual(['private-messages']);
  });
});

describe('reporting (Q24)', () => {
  it('lets only the recipient of that message report it, and the admin sees only that one', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEMELDET');
    s.say('Anna', 'Bert', 'NICHT-GEMELDET');
    s.say('Bert', 'Anna', 'ANTWORT');
    const [first] = s.view('Bert').conversations[0]!.messages;
    expect(adminMessageReports(s.ctx)).toEqual([]);
    expect(s.run('Bert', { type: 'reportPrivateMessage', id: first!.id })).toBe(
      'Nachricht gemeldet.',
    );
    expect(adminMessageReports(s.ctx)).toEqual([
      {
        id: 1,
        sender: 'Anna',
        recipient: 'Bert',
        reporter: 'Bert',
        sent: first!.time,
        reported: s.ctx.clock.t,
        text: 'GEMELDET',
      },
    ]);
    expect(JSON.stringify(adminMessageReports(s.ctx))).not.toContain('NICHT');
    expect(JSON.stringify(adminMessageReports(s.ctx))).not.toContain('ANTWORT');
  });

  it('refuses the sender, a third player and an unknown id, with the same answer, and reads nothing', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEHEIM');
    const id = s.view('Anna').conversations[0]!.messages[0]!.id;
    for (const who of ['Anna', 'Cora', 'Dirk', 'Admin'])
      expect(() => s.run(who, { type: 'reportPrivateMessage', id })).toThrow(
        GONE,
      );
    expect(() =>
      s.run('Bert', { type: 'reportPrivateMessage', id: 9999 }),
    ).toThrow(GONE);
    expect(() =>
      s.run('Bert', { type: 'reportPrivateMessage', id: '1' }),
    ).toThrow(GONE);
    expect(adminMessageReports(s.ctx)).toEqual([]);
  });

  it('answers the same for a foreign id, an unknown id and any odd id, and stores nothing', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEHEIM');
    s.say('Bert', 'Cora', 'GEHEIM-ZWEI');
    // Message 1 went Anna to Bert, message 2 Bert to Cora.
    const ids = [1, 2];
    const odd = [9999, 0, -1, 1.5, '1', null, undefined, {}];
    const tables = () =>
      JSON.stringify(
        ['message_reports', 'private_messages'].map((t) => rows(s.ctx, t)),
      );
    const before = tables();
    const answers = new Set<string>();
    const attempts: [string, unknown][] = [];
    // Dirk and the admin are in no conversation.
    for (const who of ['Dirk', 'Admin'])
      for (const id of [...ids, ...odd]) attempts.push([who, id]);
    // Each of the three sees only the message of its own conversation, and only as the recipient it may report.
    attempts.push(['Cora', 1], ['Anna', 1], ['Anna', 2], ['Bert', 2]);
    for (const id of odd) attempts.push(['Bert', id]);
    for (const [who, id] of attempts) {
      try {
        s.run(who, { type: 'reportPrivateMessage', id });
        expect.unreachable(`${who} ${JSON.stringify(id)}`);
      } catch (error) {
        answers.add((error as Error).message);
      }
    }
    // One answer for all, the words of an unknown id.
    expect([...answers]).toEqual([GONE]);
    expect(tables()).toBe(before);
    expect(rows(s.ctx, 'message_reports')).toEqual([]);
    expect(adminMessageReports(s.ctx)).toEqual([]);
  });

  it('refuses the sender even when the recipient has deleted its own view of it, and a second report', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'x');
    const id = s.view('Bert').conversations[0]!.messages[0]!.id;
    s.run('Bert', { type: 'reportPrivateMessage', id });
    expect(() => s.run('Bert', { type: 'reportPrivateMessage', id })).toThrow(
      'Diese Nachricht hast du bereits gemeldet.',
    );
    expect(adminMessageReports(s.ctx)).toHaveLength(1);
    s.say('Anna', 'Bert', 'y');
    const second = s.view('Bert').conversations[0]!.messages[1]!.id;
    s.run('Bert', { type: 'deletePrivateMessage', id: second });
    expect(() =>
      s.run('Bert', { type: 'reportPrivateMessage', id: second }),
    ).toThrow(GONE);
  });

  it('keeps the report when both sides deleted the message', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'BELEG');
    const id = s.view('Bert').conversations[0]!.messages[0]!.id;
    s.run('Bert', { type: 'reportPrivateMessage', id });
    s.run('Bert', { type: 'deletePrivateMessage', id });
    s.run('Anna', { type: 'deletePrivateMessage', id });
    expect(s.ctx.privateMessages.get(id)).toBeUndefined();
    expect(adminMessageReports(s.ctx).map((r) => r.text)).toEqual(['BELEG']);
  });
});

describe('a deleted account (Q22)', () => {
  it('keeps the conversation for the other player, with the sender as „Gelöschter Spieler“', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'Hallo');
    s.say('Bert', 'Anna', 'Hi');
    deleteAccount(s.ctx, s.ctx.players.get('u_Anna')!, 'secret1');
    const conversation = s.view('Bert').conversations;
    expect(conversation).toHaveLength(1);
    expect(conversation[0]).toMatchObject({ with: null, unread: 1 });
    expect(conversation[0]!.messages.map((m) => m.text)).toEqual([
      'Hallo',
      'Hi',
    ]);
    // The messages can still be read and deleted from the own view.
    s.run('Bert', { type: 'readPrivateMessages', name: '' });
    expect(s.view('Bert').conversations[0]!.unread).toBe(0);
    s.run('Bert', { type: 'deletePrivateConversation', name: '' });
    expect(s.view('Bert').conversations).toEqual([]);
    expect(s.ctx.privateMessages.visibleTo('u_Bert')).toEqual([]);
  });

  it('keeps a report with the pseudonym, and one cannot write to the deleted account', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'Beleidigung');
    const id = s.view('Bert').conversations[0]!.messages[0]!.id;
    s.run('Bert', { type: 'reportPrivateMessage', id });
    deleteAccount(s.ctx, s.ctx.players.get('u_Anna')!, 'secret1');
    expect(adminMessageReports(s.ctx)).toMatchObject([
      { sender: 'Gelöschter Spieler', recipient: 'Bert', text: 'Beleidigung' },
    ]);
    expect(() => s.say('Bert', 'Anna', 'x')).toThrow(UNKNOWN);
  });

  it.each([
    ['the sender', ['Anna']],
    ['the recipient, who is also the reporter', ['Bert']],
    ['both', ['Anna', 'Bert']],
  ] as const)(
    'shows „Gelöschter Spieler“ in a report whose account of %s was deleted, never an old name (Q22)',
    (_who, gone) => {
      const s = setup();
      s.say('Anna', 'Bert', 'ALT-NAME-TEST');
      const id = s.view('Bert').conversations[0]!.messages[0]!.id;
      s.run('Bert', { type: 'reportPrivateMessage', id });
      for (const name of gone)
        deleteAccount(s.ctx, s.ctx.players.get(`u_${name}`)!, 'secret1');
      const shown = adminMessageReports(s.ctx);
      const named = (name: string) =>
        (gone as readonly string[]).includes(name)
          ? 'Gelöschter Spieler'
          : name;
      expect(shown).toMatchObject([
        {
          sender: named('Anna'),
          recipient: named('Bert'),
          reporter: named('Bert'),
          text: 'ALT-NAME-TEST',
        },
      ]);
      const text = JSON.stringify(shown);
      for (const name of gone) expect(text).not.toContain(name);
    },
  );

  it('lets the account be deleted whatever it holds: messages, reports, blocks and switch', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'a');
    s.say('Bert', 'Anna', 'b');
    s.run('Anna', {
      type: 'reportPrivateMessage',
      id: s.view('Anna').conversations[0]!.messages[1]!.id,
    });
    s.run('Anna', { type: 'blockPlayer', name: 'Cora' });
    s.run('Cora', { type: 'blockPlayer', name: 'Anna' });
    s.run('Anna', { type: 'privateMessageOptions', friendsOnly: true });
    deleteAccount(s.ctx, s.ctx.players.get('u_Anna')!, 'secret1');
    expect(s.ctx.players.get('u_Anna')).toBeNull();
    expect(s.ctx.privateMessages.blockedBy('u_Cora')).toEqual([]);
    deleteAccount(s.ctx, s.ctx.players.get('u_Bert')!, 'secret1');
    expect(
      s.ctx.db.prepare('SELECT COUNT(*) FROM private_messages').pluck().get(),
    ).toBe(0);
  });
});

describe('a new round', () => {
  it('deletes the messages and the reports and keeps the block list and the switch', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'weg');
    s.run('Bert', {
      type: 'reportPrivateMessage',
      id: s.view('Bert').conversations[0]!.messages[0]!.id,
    });
    s.run('Bert', { type: 'blockPlayer', name: 'Cora' });
    s.run('Bert', { type: 'privateMessageOptions', friendsOnly: true });
    s.run('Admin', { type: 'reset', guilds: true });
    expect(s.view('Bert').conversations).toEqual([]);
    expect(s.view('Anna').conversations).toEqual([]);
    expect(adminMessageReports(s.ctx)).toEqual([]);
    expect(s.view('Bert').blocked).toEqual(['Cora']);
    expect(s.view('Bert').friendsOnly).toBe(true);
  });

  it('clears the copy of the reported text with the round, also the one of a deleted account', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'KOPIE-IM-BERICHT');
    s.say('Cora', 'Dirk', 'KOPIE-ZWEI');
    for (const [who, id] of [
      ['Bert', 1],
      ['Dirk', 2],
    ] as const)
      s.run(who, { type: 'reportPrivateMessage', id });
    deleteAccount(s.ctx, s.ctx.players.get('u_Cora')!, 'secret1');
    expect(rows(s.ctx, 'message_reports')).toHaveLength(2);
    s.run('Admin', { type: 'reset', guilds: true });
    expect(rows(s.ctx, 'message_reports')).toEqual([]);
    expect(rows(s.ctx, 'private_messages')).toEqual([]);
    const tables = s.ctx.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .pluck()
      .all() as string[];
    expect(
      tables.filter((t) => dumpOutside(s.ctx, [t]).includes('KOPIE')),
    ).toEqual([]);
  });
});

describe('the journal', () => {
  it('keeps the length of a message and never its text', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEHEIMTEXT-JOURNAL');
    const dump = JSON.stringify(
      s.ctx.db.prepare('SELECT * FROM round_events').all(),
    );
    expect(dump).not.toContain('GEHEIMTEXT');
  });
});

/** Every table of the database as text: a secret may be in no other table than the messages. */
export const dumpOutside = (ctx: TestCtx, tables: string[]): string =>
  JSON.stringify(tables.map((t) => ctx.db.prepare(`SELECT * FROM ${t}`).all()));

describe('the audit log', () => {
  it('never holds the text of a message', () => {
    const s = setup();
    s.say('Anna', 'Bert', 'GEHEIMTEXT-AUDIT');
    expect(dumpOutside(s.ctx, ['audit_events'])).not.toContain('GEHEIMTEXT');
  });
});
