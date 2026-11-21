// The private messages in the browser (#226): what the inbox and the sent
// messages show, the number of unread messages, and the event of a component.
import { describe, expect, it, vi } from 'vitest';
import { dt } from './format.ts';
import {
  MESSAGE_TABS,
  PM_EVENT,
  PM_LABELS,
  isLoad,
  newestId,
  openQuery,
  pmAsk,
  pmCall,
  privatePage,
  privateUnread,
  questionFor,
  sentWithOlder,
  sentWithout,
  startSent,
  startThread,
  watchConversation,
  withNewer,
  withOlder,
  withoutLine,
  withRead,
  type MessageLine,
  type PmCall,
  type PmRequest,
  type Thread,
} from './private-messages.ts';
import type { GameState } from './types.ts';
import type { V } from '../views/common.ts';

const line = (id: number, mine: boolean, read = true, text = `m${id}`) => ({
  id,
  mine,
  time: 1_000 * id,
  text,
  read,
});

const view = (privateMessages?: GameState['privateMessages']): V =>
  ({
    s: {
      me: { id: 'u_Anna' },
      players: {
        u_Anna: { name: 'Anna', points: 1 },
        u_Cora: { name: 'Cora', points: 1 },
        u_Bert: { name: 'Bert', points: 1 },
        u_Dora: { name: 'Ärger', points: 1 },
      },
      privateMessages,
    },
  }) as unknown as V;

const OWN: NonNullable<GameState['privateMessages']> = {
  friendsOnly: true,
  blocked: ['Cora'],
  conversations: [
    { with: 'Bert', unread: 2, more: true, last: line(9, false, false) },
    { with: null, unread: 0, more: true, last: line(3, true) },
  ],
};

describe('the tabs', () => {
  it('are the reports first, then the inbox and the sent messages', () => {
    expect(MESSAGE_TABS).toEqual({
      reports: 'Berichte',
      inbox: 'Posteingang',
      sent: 'Gesendet',
    });
    expect(Object.keys(MESSAGE_TABS)).toEqual(['reports', 'inbox', 'sent']);
  });

  it('use the words of the issue for the buttons', () => {
    expect(PM_LABELS.compose).toBe('Neue Nachricht');
    expect(PM_LABELS.recipient).toBe('Empfänger');
    expect(PM_LABELS.reply).toBe('Antworten');
    expect(PM_LABELS.report).toBe('Melden');
  });
});

describe('the page', () => {
  it('lists the conversations as the state gives them, the deleted account under its pseudonym', () => {
    const page = privatePage(view(OWN));
    expect(page.inbox.map((r) => [r.key, r.name, r.deleted, r.unread])).toEqual(
      [
        ['Bert', 'Bert', false, 2],
        ['', 'Gelöschter Spieler', true, 0],
      ],
    );
    expect(page.inbox[0]!.last).toBe(dt(9_000));
    // The state carries the newest message only: the preview (Q32).
    expect(page.inbox[0]!.preview).toEqual({
      id: 9,
      mine: false,
      time: dt(9_000),
      text: 'm9',
      fresh: true,
    });
    expect(page.inbox.map((r) => r.more)).toEqual([true, true]);
    expect(page.inbox.map((r) => r.newer)).toEqual([[], []]);
    expect(page.friendsOnly).toBe(true);
    expect(page.blocked).toEqual(['Cora']);
    expect(page.unread).toBe(2);
  });

  it('offers every other player as a recipient, sorted', () => {
    expect(privatePage(view(OWN)).names).toEqual(['Ärger', 'Bert', 'Cora']);
  });

  it('keeps a text as text: no markup is made of it', () => {
    const page = privatePage(
      view({
        friendsOnly: false,
        blocked: [],
        conversations: [
          {
            with: 'Bert',
            unread: 0,
            more: false,
            last: line(1, false, true, '<img src=x onerror=alert(1)>'),
          },
        ],
      }),
    );
    expect(page.inbox[0]!.preview.text).toBe('<img src=x onerror=alert(1)>');
  });

  it('is empty for a state without the part', () => {
    const page = privatePage(view(undefined));
    expect(page).toMatchObject({
      inbox: [],
      friendsOnly: false,
      blocked: [],
      unread: 0,
    });
  });
});

describe('the number of unread messages', () => {
  it('adds the unread messages of every conversation', () => {
    expect(privateUnread({ privateMessages: OWN })).toBe(2);
    expect(
      privateUnread({
        privateMessages: {
          ...OWN,
          conversations: [
            { with: 'A', unread: 3, more: false, last: line(1, false) },
            { with: 'B', unread: 4, more: false, last: line(2, false) },
          ],
        },
      }),
    ).toBe(7);
  });

  it('is zero without the part', () => {
    expect(privateUnread({})).toBe(0);
  });
});

describe('the questions', () => {
  it('asks before a deletion and a report, and before nothing else', () => {
    const calls: PmCall[] = [
      ['sendPrivateMessage', { name: 'Bert', text: 'x' }],
      ['readPrivateMessages', { name: 'Bert' }],
      ['deletePrivateMessage', { id: 1 }],
      ['deletePrivateConversation', { name: 'Bert' }],
      ['reportPrivateMessage', { id: 1 }],
      ['blockPlayer', { name: 'Bert' }],
      ['unblockPlayer', { name: 'Bert' }],
      ['privateMessageOptions', { friendsOnly: true }],
      ['olderPrivateMessages', { before: 7 }],
      ['openPrivateConversation', { name: 'Bert' }],
      ['sentPrivateMessages', {}],
      ['sentPrivateMessages', { before: 7 }],
    ];
    expect(calls.map(questionFor)).toEqual([
      null,
      null,
      'Nachricht löschen?',
      'Unterhaltung löschen?',
      'Nachricht der Spielleitung melden?',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('knows the three loads, which read and change nothing', () => {
    expect(isLoad(['olderPrivateMessages', { before: 7 }])).toBe(true);
    expect(isLoad(['openPrivateConversation', { name: '' }])).toBe(true);
    expect(isLoad(['sentPrivateMessages', {}])).toBe(true);
    for (const call of [
      ['sendPrivateMessage', { name: 'Bert', text: 'x' }],
      ['readPrivateMessages', { name: 'Bert' }],
      ['deletePrivateMessage', { id: 1 }],
      ['blockPlayer', { name: 'Bert' }],
    ] as PmCall[])
      expect(isLoad(call), call[0]).toBe(false);
  });
});

describe('pmCall', () => {
  it('sends the event with the call and resolves with the answer', async () => {
    let request: PmRequest | undefined;
    const target = {
      dispatchEvent: vi.fn((e: Event) => {
        request = (e as CustomEvent<PmRequest>).detail;
        expect(e.type).toBe(PM_EVENT);
        expect(e.bubbles).toBe(true);
        return true;
      }),
    } as unknown as Element;
    const call: PmCall = ['blockPlayer', { name: 'Bert' }];
    const result = pmCall(target, call);
    expect(request).toMatchObject({ call, quiet: false });
    request!.done(true);
    await expect(result).resolves.toBe(true);
    const quiet = pmCall(target, call, true);
    expect(request!.quiet).toBe(true);
    request!.done(false);
    await expect(quiet).resolves.toBe(false);
  });
});

const shown = (...ids: number[]): MessageLine[] =>
  ids.map((id) => ({
    id,
    mine: false,
    time: String(id),
    text: `m${id}`,
    fresh: false,
  }));

const thread = (ids: number[], more = true): Thread => ({
  lines: shown(...ids),
  more,
});

describe('an open conversation (Q27, Q32)', () => {
  it('starts with the page the action loaded, in its order, with its `more`', () => {
    const t = startThread([line(5, false, false), line(6, true)], true);
    expect(t.lines).toEqual([
      { id: 5, mine: false, time: dt(5_000), text: 'm5', fresh: true },
      { id: 6, mine: true, time: dt(6_000), text: 'm6', fresh: false },
    ]);
    expect(t.more).toBe(true);
    expect(startThread([], false)).toEqual({ lines: [], more: false });
    expect(newestId(t)).toBe(6);
    expect(newestId(startThread([], false))).toBe(0);
  });

  it('puts an older page in front, in order, and takes its `more`', () => {
    const t = withOlder(
      thread([60, 61]),
      [line(58, false), line(59, true)],
      true,
    );
    expect(t.lines.map((l) => l.id)).toEqual([58, 59, 60, 61]);
    expect(t.lines[1]).toMatchObject({ mine: true, fresh: false, text: 'm59' });
    expect(t.more).toBe(true);
    // The next page goes in front of the first one, with no gap and no duplicate.
    const again = withOlder(t, [line(56, false), line(57, false)], false);
    expect(again.lines.map((l) => l.id)).toEqual([56, 57, 58, 59, 60, 61]);
    expect(again.more).toBe(false);
    // A message held already is not added twice.
    expect(
      withOlder(again, [line(56, false), line(55, false)], false).lines.map(
        (l) => l.id,
      ),
    ).toEqual([55, 56, 57, 58, 59, 60, 61]);
  });

  it('adds the new messages of the state at the end, only the ones newer than the newest held', () => {
    const t = thread([60, 61]);
    const next = withNewer(t, shown(61, 62, 63));
    expect(next.lines.map((l) => l.id)).toEqual([60, 61, 62, 63]);
    // The same answer again, or an older poll, changes nothing and is the same thread.
    expect(withNewer(next, shown(61, 62, 63))).toBe(next);
    expect(withNewer(next, [])).toBe(next);
    expect(withNewer(next, shown(10))).toBe(next);
    // Out of order, they join in order of their ids.
    expect(withNewer(t, shown(64, 62, 63)).lines.map((l) => l.id)).toEqual([
      60, 61, 62, 63, 64,
    ]);
    // The older part and `more` stay.
    expect(next.more).toBe(true);
    // A thread that is empty takes all of them.
    expect(
      withNewer({ lines: [], more: false }, shown(3, 4)).lines.map((l) => l.id),
    ).toEqual([3, 4]);
  });

  it('keeps an older page while new messages come in: no gap opens (the window does not matter any more)', () => {
    const t = withNewer(
      withOlder(thread([60, 61]), [line(58, false), line(59, false)], false),
      shown(62),
    );
    expect(t.lines.map((l) => l.id)).toEqual([58, 59, 60, 61, 62]);
    expect(t.more).toBe(false);
  });

  it('drops a message the player deleted, and clears the marks once read', () => {
    const t = startThread(
      [line(5, false, false), line(6, false, false)],
      false,
    );
    expect(withoutLine(t, 5).lines.map((l) => l.id)).toEqual([6]);
    expect(withoutLine(t, 99).lines).toHaveLength(2);
    const read = withRead(t);
    expect(read.lines.map((l) => l.fresh)).toEqual([false, false]);
    expect(withRead(read)).toBe(read);
  });

  it('notes the open conversation for the poll and the actions, and nothing while none is open', () => {
    watchConversation(null);
    expect(openQuery()).toEqual({});
    watchConversation({ name: 'Bert', after: 12 });
    expect(openQuery()).toEqual({ pm: 'Bert', pmAfter: 12 });
    watchConversation({ name: '', after: 0 });
    expect(openQuery()).toEqual({ pm: '', pmAfter: 0 });
    watchConversation(null);
    expect(openQuery()).toEqual({});
  });

  it('brings the messages of the open conversation to its row only', () => {
    const own = {
      ...OWN,
      open: { with: 'Bert', messages: [line(10, false, false)] },
    };
    const page = privatePage(view(own));
    expect(page.inbox.map((r) => r.newer.map((l) => l.id))).toEqual([[10], []]);
    expect(page.inbox[0]!.newer[0]).toMatchObject({ fresh: true, text: 'm10' });
    // The deleted accounts have their own open conversation.
    const deleted = privatePage(
      view({ ...OWN, open: { with: null, messages: [line(11, false)] } }),
    );
    expect(deleted.inbox.map((r) => r.newer.length)).toEqual([0, 1]);
  });
});

describe('the sent messages (Q33)', () => {
  const sent = (...ids: number[]) =>
    ids.map((id) => ({
      id,
      to: id % 2 ? 'Bert' : null,
      time: 1_000 * id,
      text: `s${id}`,
    }));

  it('lists a page as it came, newest first, the deleted account under its pseudonym', () => {
    expect(startSent(sent(9, 8), true)).toEqual({
      rows: [
        { id: 9, to: 'Bert', time: dt(9_000), text: 's9' },
        { id: 8, to: 'Gelöschter Spieler', time: dt(8_000), text: 's8' },
      ],
      more: true,
    });
    expect(startSent([], false)).toEqual({ rows: [], more: false });
  });

  it('adds an older page at the end, with no duplicate, and takes its `more`', () => {
    const list = startSent(sent(9, 8), true);
    const next = sentWithOlder(list, sent(8, 7, 6), false);
    expect(next.rows.map((r) => r.id)).toEqual([9, 8, 7, 6]);
    expect(next.more).toBe(false);
  });

  it('drops a deleted message, and keeps a text as text', () => {
    const list = startSent(
      [{ id: 1, to: '<u>x</u>', time: 1, text: '<script>x</script>' }],
      false,
    );
    expect(list.rows[0]).toMatchObject({
      to: '<u>x</u>',
      text: '<script>x</script>',
    });
    expect(sentWithout(startSent(sent(3, 2), false), 3).rows).toHaveLength(1);
  });
});

describe('pmAsk', () => {
  it('passes the data of the answer through pmAsk, and pmCall stays a boolean', async () => {
    const answerWith = (ok: boolean, data?: Record<string, unknown>) => {
      const target = {
        dispatchEvent: (e: Event) => {
          (e as CustomEvent<PmRequest>).detail.done(ok, data);
          return true;
        },
      } as unknown as Element;
      return target;
    };
    const call: PmCall = ['olderPrivateMessages', { before: 4 }];
    await expect(
      pmAsk(answerWith(true, { more: true }), call),
    ).resolves.toEqual({
      ok: true,
      data: { more: true },
    });
    await expect(pmAsk(answerWith(false), call)).resolves.toEqual({
      ok: false,
      data: {},
    });
    await expect(pmCall(answerWith(true, { more: true }), call)).resolves.toBe(
      true,
    );
  });
});
