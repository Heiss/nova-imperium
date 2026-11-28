// The tabs of „Nachrichten“ with their counts (#226, #496).
import { describe, expect, it } from 'vitest';
import { counted, guildUnread, messageTabs } from './message-tabs.ts';
import type { GameState } from './types.ts';

const state = (unread: number, chat: number | null) =>
  ({
    privateMessages: {
      friendsOnly: false,
      blocked: [],
      conversations: [{ with: 'Bert', unread, more: false, last: null }],
    },
    guilds:
      chat === null
        ? { directory: [], own: null, management: null, chat: null }
        : {
            directory: [],
            own: { id: 'g1', status: 'member' },
            management: null,
            chat: {
              read: true,
              write: true,
              messages: [],
              unread: chat > 0,
              unreadCount: chat,
            },
          },
  }) as unknown as GameState;

describe('the tabs of „Nachrichten“', () => {
  it('has „Gilde“ with its count for a member with a chat, after „Gesendet“', () => {
    expect(messageTabs(state(2, 3), false)).toEqual([
      { key: 'reports', label: 'Berichte' },
      { key: 'inbox', label: 'Posteingang (2)' },
      { key: 'sent', label: 'Gesendet' },
      { key: 'guild', label: 'Gilde (3)' },
    ]);
    expect(messageTabs(state(0, 0), false).map((t) => t.label)).toEqual([
      'Berichte',
      'Posteingang',
      'Gesendet',
      'Gilde',
    ]);
  });

  it('has no „Gilde“ without a chat (no guild, no chat right, guilds off)', () => {
    expect(messageTabs(state(0, null), false).map((t) => t.key)).toEqual([
      'reports',
      'inbox',
      'sent',
    ]);
    const off = { privateMessages: undefined, guilds: undefined };
    expect(messageTabs(off, false).map((t) => t.key)).toEqual([
      'reports',
      'inbox',
      'sent',
    ]);
  });

  it('has no „Berichte“ on the lock screen of the vacation mode', () => {
    expect(messageTabs(state(0, 1), true).map((t) => t.key)).toEqual([
      'inbox',
      'sent',
      'guild',
    ]);
  });

  it('counts only a count that is not 0', () => {
    expect(counted('Gilde', 0)).toBe('Gilde');
    expect(counted('Gilde', 12)).toBe('Gilde (12)');
    expect(guildUnread(state(0, null))).toBe(0);
    expect(guildUnread(state(0, 4))).toBe(4);
  });
});
