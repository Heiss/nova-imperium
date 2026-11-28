// The chat window (#496): what it shows, and what the browser keeps.
import { describe, expect, it, vi } from 'vitest';
import type { V } from '../views/common.ts';
import {
  chatWindowPage,
  NO_PREFS,
  readPrefs,
  shownTab,
  writePrefs,
} from './chat-window.ts';

const view = (
  over: { chat?: number | null; pm?: number; on?: number } = {},
): Pick<V, 's'> =>
  ({
    s: {
      me: { id: 'u_Anna' },
      players: { u_Anna: { name: 'Anna' }, u_Bert: { name: 'Bert' } },
      round: over.on === undefined ? {} : { chatWindowOn: over.on },
      privateMessages: {
        friendsOnly: false,
        blocked: [],
        conversations: [
          {
            with: 'Bert',
            unread: over.pm ?? 0,
            more: false,
            last: { id: 1, mine: false, time: 1000, text: 'Hallo', read: true },
          },
        ],
      },
      guilds:
        over.chat === null
          ? null
          : {
              directory: [],
              own: { id: 'g1', status: 'member' },
              management: null,
              chat: {
                read: true,
                write: true,
                messages: [],
                unread: (over.chat ?? 0) > 0,
                unreadCount: over.chat ?? 0,
              },
            },
    },
  }) as unknown as Pick<V, 's'>;

describe('the chat window', () => {
  it('has „Gilde“ and „Persönlich“ with their counts, and the sum on its button', () => {
    const page = chatWindowPage(view({ chat: 2, pm: 3 }), 'overview')!;
    expect(page.tabs).toEqual([
      { key: 'guild', label: 'Gilde (2)' },
      { key: 'private', label: 'Persönlich (3)' },
    ]);
    expect(page.button).toBe('Chat (5)');
    expect(page.guild).not.toBeNull();
    expect(page.mail.inbox.map((r) => r.key)).toEqual(['Bert']);
    expect(chatWindowPage(view(), 'overview')!.button).toBe('Chat');
  });

  it('has „Persönlich“ only without a guild chat (Q3: one tab stays a tab)', () => {
    const page = chatWindowPage(view({ chat: null, pm: 1 }), 'overview')!;
    expect(page.tabs).toEqual([{ key: 'private', label: 'Persönlich (1)' }]);
    expect(page.guild).toBeNull();
    expect(page.button).toBe('Chat (1)');
  });

  it('is gone while its switch is off, and while „Nachrichten“ is the view', () => {
    expect(chatWindowPage(view({ on: 0 }), 'overview')).toBeNull();
    expect(chatWindowPage(view({ on: 1 }), 'overview')).not.toBeNull();
    expect(chatWindowPage(view(), 'messages')).toBeNull();
    expect(chatWindowPage(view(), 'guilds')).not.toBeNull();
  });

  it('shows the chosen tab while it is there, else the first', () => {
    const both = chatWindowPage(view(), 'overview')!;
    const one = chatWindowPage(view({ chat: null }), 'overview')!;
    expect(shownTab(both, 'private')).toBe('private');
    expect(shownTab(both, 'guild')).toBe('guild');
    expect(shownTab(one, 'guild')).toBe('private');
  });
});

describe('what the browser keeps of the window', () => {
  const memory = () => {
    const items = new Map<string, string>();
    return {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      items,
    };
  };

  it('keeps open or closed and the tab per player', () => {
    const store = memory();
    expect(readPrefs('u1', () => store)).toEqual(NO_PREFS);
    writePrefs('u1', { open: true, tab: 'private' }, () => store);
    expect(readPrefs('u1', () => store)).toEqual({
      open: true,
      tab: 'private',
    });
    expect(readPrefs('u2', () => store)).toEqual(NO_PREFS);
    expect([...store.items.keys()]).toEqual(['nova.chatwin.u1']);
  });

  it('reads closed for what it cannot read, and lives without storage', () => {
    const store = memory();
    for (const raw of ['{', '"x"', 'null', '{"open":1,"tab":"x"}']) {
      store.items.set('nova.chatwin.u1', raw);
      expect(readPrefs('u1', () => store)).toEqual(NO_PREFS);
    }
    store.items.set('nova.chatwin.u1', '{"open":true,"tab":"guild"}');
    expect(readPrefs('u1', () => store)).toEqual({ open: true, tab: 'guild' });
    const none = () => {
      throw new Error('no storage');
    };
    expect(readPrefs('u1', none)).toEqual(NO_PREFS);
    const write = vi.fn(none);
    expect(() =>
      writePrefs('u1', { open: true, tab: 'guild' }, write),
    ).not.toThrow();
    expect(write).toHaveBeenCalledOnce();
  });
});
