import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canDeleteChat,
  CHAT_HISTORY,
  CHAT_INTERVAL,
  chatLength,
  chatTextError,
  MAX_CHAT_TEXT,
} from './guild-chat.ts';
import { GUILD_RIGHTS, type GuildRight } from './guild-ranks.ts';

// The pure rules of the guild chat (#169).

describe('limits', () => {
  it('has the values of the issue and the owner', () => {
    expect(MAX_CHAT_TEXT).toBe(1000);
    expect(CHAT_HISTORY).toBe(500);
    expect(CHAT_INTERVAL).toBe(2000);
  });

  it('counts characters, not code units', () => {
    expect(chatLength('')).toBe(0);
    expect(chatLength('abc')).toBe(3);
    expect(chatLength('ä😀')).toBe(2);
    expect('😀'.length).toBe(2);
  });

  it('takes 1 to 1,000 characters', () => {
    expect(chatTextError('')).toBe('empty');
    expect(chatTextError('a')).toBeNull();
    expect(chatTextError('a'.repeat(1000))).toBeNull();
    expect(chatTextError('a'.repeat(1001))).toBe('length');
    // 1,000 emoji are 2,000 code units and still 1,000 characters.
    expect(chatTextError('😀'.repeat(1000))).toBeNull();
    expect(chatTextError('😀'.repeat(1001))).toBe('length');
  });

  it('refuses exactly the texts longer than the limit (property)', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'grapheme', minLength: 1, maxLength: 1100 }),
        (text) => {
          const error = chatTextError(text);
          expect(error === 'length').toBe([...text].length > MAX_CHAT_TEXT);
          expect(error).not.toBe('empty');
        },
      ),
      { seed: 169, numRuns: 200 },
    );
  });
});

describe('deleting a message (#169 D2, the order of #163)', () => {
  const del: GuildRight[] = ['chat-delete'];

  it('needs the right „Chatnachrichten löschen“', () => {
    const without = GUILD_RIGHTS.filter((r) => r !== 'chat-delete');
    expect(canDeleteChat({ position: 0, rights: without }, true, 5)).toBe(
      false,
    );
    expect(canDeleteChat({ position: 1, rights: [] }, false, Infinity)).toBe(
      false,
    );
    expect(canDeleteChat({ position: 1, rights: del }, false, 2)).toBe(true);
  });

  it('deletes only messages of lower ranks, former members and its own', () => {
    const actor = { position: 2, rights: del };
    expect(canDeleteChat(actor, false, 3)).toBe(true);
    expect(canDeleteChat(actor, false, Infinity)).toBe(true);
    expect(canDeleteChat(actor, false, 2)).toBe(false);
    expect(canDeleteChat(actor, false, 1)).toBe(false);
    expect(canDeleteChat(actor, false, 0)).toBe(false);
    expect(canDeleteChat(actor, true, 2)).toBe(true);
  });

  it('lets the Leitung delete every message but needs the right for it (property)', () => {
    fc.assert(
      fc.property(
        fc.subarray([...GUILD_RIGHTS]),
        fc.nat(30),
        fc.option(fc.nat(30), { nil: Infinity }),
        fc.boolean(),
        (rights, position, author, own) => {
          const allowed = canDeleteChat({ position, rights }, own, author);
          expect(allowed).toBe(
            rights.includes('chat-delete') && (own || author > position),
          );
          if (rights.includes('chat-delete'))
            expect(
              canDeleteChat({ position: 0, rights }, own, author || 1),
            ).toBe(true);
        },
      ),
      { seed: 169, numRuns: 300 },
    );
  });
});
