// The private messages in the browser (#226): what the inbox and the sent
// messages show, the number of unread messages, and the event of a component.
import { describe, expect, it, vi } from 'vitest';
import { dt } from './format.ts';
import {
  MESSAGE_TABS,
  PM_EVENT,
  PM_LABELS,
  pmAsk,
  pmCall,
  privatePage,
  privateUnread,
  questionFor,
  threadLines,
  withOlder,
  type MessageLine,
  type PmCall,
  type PmRequest,
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
    {
      with: 'Bert',
      unread: 2,
      more: false,
      messages: [line(5, false, false), line(6, true), line(9, false, false)],
    },
    {
      with: null,
      unread: 0,
      more: false,
      messages: [line(2, false), line(3, true)],
    },
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
    expect(page.inbox[0]!.lines.map((l) => [l.id, l.mine, l.fresh])).toEqual([
      [5, false, true],
      [6, true, false],
      [9, false, true],
    ]);
    expect(page.friendsOnly).toBe(true);
    expect(page.blocked).toEqual(['Cora']);
    expect(page.unread).toBe(2);
  });

  it('lists the sent messages newest first, with the recipient', () => {
    expect(privatePage(view(OWN)).sent).toEqual([
      { id: 6, to: 'Bert', time: dt(6_000), text: 'm6' },
      { id: 3, to: 'Gelöschter Spieler', time: dt(3_000), text: 'm3' },
    ]);
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
            messages: [line(1, false, true, '<img src=x onerror=alert(1)>')],
          },
        ],
      }),
    );
    expect(page.inbox[0]!.lines[0]!.text).toBe('<img src=x onerror=alert(1)>');
  });

  it('is empty for a state without the part', () => {
    const page = privatePage(view(undefined));
    expect(page).toMatchObject({
      inbox: [],
      sent: [],
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
            { with: 'A', unread: 3, more: false, messages: [] },
            { with: 'B', unread: 4, more: false, messages: [] },
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
    ]);
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

describe('older messages of an open conversation (Q27)', () => {
  const row = (ids: number[], more = true) => ({ lines: shown(...ids), more });

  it('shows the state as it is until a page was loaded, with its `more`', () => {
    expect(threadLines(row([60, 61]), null)).toEqual({
      lines: shown(60, 61),
      more: true,
    });
    expect(threadLines(row([60], false), null).more).toBe(false);
  });

  it('puts a loaded page in front, in order, and takes its `more`', () => {
    const older = withOlder(
      row([60, 61]),
      null,
      [line(58, false), line(59, true)],
      true,
    );
    const view = threadLines(row([60, 61]), older);
    expect(view.lines.map((l) => l.id)).toEqual([58, 59, 60, 61]);
    expect(view.lines[1]).toMatchObject({
      mine: true,
      fresh: false,
      text: 'm59',
    });
    expect(view.more).toBe(true);
    // The next page goes in front of the first one, with no gap and no duplicate.
    const again = withOlder(
      row([60, 61]),
      older,
      [line(56, false), line(57, false)],
      false,
    );
    const all = threadLines(row([60, 61]), again);
    expect(all.lines.map((l) => l.id)).toEqual([56, 57, 58, 59, 60, 61]);
    expect(all.more).toBe(false);
  });

  it('follows new messages of the state while its window starts where it did', () => {
    const older = withOlder(row([60, 61]), null, [line(59, false)], false);
    expect(
      threadLines(row([60, 61, 62]), older).lines.map((l) => l.id),
    ).toEqual([59, 60, 61, 62]);
  });

  it('drops the page once the window moved, so no gap opens; the next load starts at the window', () => {
    const older = withOlder(
      row([60, 61]),
      null,
      [line(58, false), line(59, false)],
      false,
    );
    // New messages pushed 60 out of the page, or the player deleted 60.
    expect(threadLines(row([61, 62]), older)).toEqual({
      lines: shown(61, 62),
      more: true,
    });
    // A page loaded now is the only one in front of the new window.
    const next = withOlder(row([61, 62]), older, [line(60, false)], true);
    expect(threadLines(row([61, 62]), next).lines.map((l) => l.id)).toEqual([
      60, 61, 62,
    ]);
  });

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

  it('marks the conversation with `more` for the button', () => {
    const page = privatePage(
      view({
        friendsOnly: false,
        blocked: [],
        conversations: [
          { with: 'Bert', unread: 0, more: true, messages: [line(9, false)] },
        ],
      }),
    );
    expect(page.inbox[0]!.more).toBe(true);
  });
});
