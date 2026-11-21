import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canDeleteChat,
  CHAT_EVENTS,
  CHAT_HISTORY,
  CHAT_INTERVAL,
  chatEventText,
  chatLength,
  chatTextError,
  chatUnread,
  deleteChatError,
  isChatEvent,
  MAX_CHAT_TEXT,
  seeChatError,
  sendChatError,
} from './guild-chat.ts';
import { GUILD_RIGHTS, type GuildRight } from './guild-ranks.ts';
import { ROUND_SETTINGS, roundFieldId, roundRefused } from './round.ts';
import { liveSpecs } from './universe.ts';

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

describe('the checks of the chat actions (#214)', () => {
  const rule = (rights: GuildRight[], position = 1) => ({ position, rights });
  const write = rule(['chat-write']);

  it('sendChatError: the right, a text, then the pause', () => {
    expect(sendChatError(rule(['chat-read']), 'Hallo', 0, undefined)).toBe(
      'right',
    );
    expect(sendChatError(rule([]), 7, 0, 0)).toBe('right');
    expect(sendChatError(write, 7, 0, undefined)).toBe('empty');
    expect(sendChatError(write, undefined, 0, undefined)).toBe('empty');
    expect(sendChatError(write, '', 0, undefined)).toBe('empty');
    expect(sendChatError(write, 'a'.repeat(1001), 0, 0)).toBe('length');
    expect(sendChatError(write, 'Hallo', 0, undefined)).toBeNull();
    expect(
      sendChatError(write, 'Hallo', 5000, 5000 - CHAT_INTERVAL),
    ).toBeNull();
    expect(sendChatError(write, 'Hallo', 5000, 5000 - CHAT_INTERVAL + 1)).toBe(
      'wait',
    );
    expect(sendChatError(write, 'Hallo', 5000, 5000)).toBe('wait');
  });

  it('deleteChatError: the right, the message, no event, then canDeleteChat', () => {
    const del = rule(['chat-delete'], 2);
    const msg = (kind: string, own: boolean, author: number) => ({
      kind,
      own,
      author,
    });
    expect(deleteChatError(rule([], 0), msg('message', true, 3))).toBe('right');
    expect(deleteChatError(rule(['chat-read'], 0), undefined)).toBe('right');
    expect(deleteChatError(del, undefined)).toBe('message');
    expect(deleteChatError(del, msg('join', false, Infinity))).toBe('event');
    expect(deleteChatError(del, msg('attack', true, 2))).toBe('event');
    expect(deleteChatError(del, msg('message', false, 1))).toBe('lower');
    expect(deleteChatError(del, msg('message', false, 2))).toBe('lower');
    expect(deleteChatError(del, msg('message', false, 3))).toBeNull();
    expect(deleteChatError(del, msg('message', true, 2))).toBeNull();
  });

  it('seeChatError: the right „Chat lesen“', () => {
    expect(seeChatError(rule(['chat-read']))).toBeNull();
    expect(seeChatError(rule(['chat-write', 'chat-delete']))).toBe('right');
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

describe('event messages (#169 D3, D4; owner, 2026-11-15)', () => {
  it('has the kinds of the owner: joining, leaving, removal, a rank, an attack', () => {
    expect(CHAT_EVENTS).toEqual(['join', 'leave', 'remove', 'rank', 'attack']);
    for (const kind of CHAT_EVENTS) expect(isChatEvent(kind)).toBe(true);
    for (const kind of ['message', 'spy', '', null, undefined, 1])
      expect(isChatEvent(kind)).toBe(false);
  });

  it('writes the short sentences of the owner', () => {
    expect(chatEventText({ kind: 'join', name: 'Anna', text: '' }, '')).toBe(
      'Anna ist der Gilde beigetreten.',
    );
    expect(chatEventText({ kind: 'leave', name: 'Anna', text: '' }, '')).toBe(
      'Anna hat die Gilde verlassen.',
    );
    expect(chatEventText({ kind: 'remove', name: 'Anna', text: '' }, '')).toBe(
      'Anna wurde aus der Gilde entfernt.',
    );
    expect(
      chatEventText({ kind: 'rank', name: 'Anna', text: 'Offizier' }, ''),
    ).toBe('Anna ist jetzt Offizier.');
  });

  it('writes the attack with the target, the attacker, the member and the arrival', () => {
    expect(
      chatEventText(
        { kind: 'attack', name: 'Lea', text: '[1:27:11]', attacker: 'Vex' },
        '20:15',
      ),
    ).toBe('⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15');
  });

  it('names a deleted account „ehemaliges Mitglied“, a deleted attacker „Unbekannt“', () => {
    expect(chatEventText({ kind: 'join', name: null, text: '' }, '')).toBe(
      'Ehemaliges Mitglied ist der Gilde beigetreten.',
    );
    expect(chatEventText({ kind: 'leave', name: null, text: '' }, '')).toBe(
      'Ehemaliges Mitglied hat die Gilde verlassen.',
    );
    expect(
      chatEventText({ kind: 'rank', name: null, text: 'Rekrut' }, ''),
    ).toBe('Ehemaliges Mitglied ist jetzt Rekrut.');
    expect(
      chatEventText(
        { kind: 'attack', name: null, text: '[2:3:4]', attacker: null },
        '16.11., 01:02',
      ),
    ).toBe(
      '⚔ Angriff auf [2:3:4] (Unbekannt → ehemaliges Mitglied), Ankunft 16.11., 01:02',
    );
    expect(
      chatEventText({ kind: 'attack', name: 'Lea', text: '[2:3:4]' }, '9:00'),
    ).toBe('⚔ Angriff auf [2:3:4] (Unbekannt → Lea), Ankunft 9:00');
  });
});

describe('the red mark on „Gilden“ (#169; owner, 2026-11-15)', () => {
  it('shows messages of others newer than the last visit', () => {
    expect(chatUnread([], 0)).toBe(false);
    expect(chatUnread([{ id: 3, own: false }], 2)).toBe(true);
    expect(chatUnread([{ id: 3, own: false }], 3)).toBe(false);
    expect(chatUnread([{ id: 3, own: false }], 4)).toBe(false);
    // The own messages are never new for the writer.
    expect(chatUnread([{ id: 3, own: true }], 0)).toBe(false);
    expect(
      chatUnread(
        [
          { id: 1, own: false },
          { id: 5, own: true },
        ],
        1,
      ),
    ).toBe(false);
    expect(
      chatUnread(
        [
          { id: 1, own: true },
          { id: 5, own: false },
        ],
        4,
      ),
    ).toBe(true);
  });

  it('is the same as „some message of another is newer“ (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.nat(50), own: fc.boolean() })),
        fc.nat(60),
        (messages, seen) => {
          expect(chatUnread(messages, seen)).toBe(
            messages.filter((m) => !m.own).some((m) => m.id > seen),
          );
        },
      ),
      { seed: 169, numRuns: 200 },
    );
  });
});

describe('the guild switch of a round (#191, #283)', () => {
  const guilds = ROUND_SETTINGS.filter((s) => s.key === 'roundGuilds');
  const refused = (value: unknown) =>
    roundRefused({ guilds: true }, { guilds: value }, guilds).length;

  it('is one entry of the registry: a switch, on by default, with its warning, not live', () => {
    expect(guilds).toEqual([
      {
        kind: 'switch',
        key: 'roundGuilds',
        name: 'guilds',
        label: 'Gilden (mit Chat)',
        order: 30,
        def: true,
        refusal: 'Bitte auswählen, ob Gilden in der neuen Runde an sind.',
        note: 'Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.',
      },
    ]);
    expect(guilds.map(roundFieldId)).toEqual(['round-guilds']);
    expect(liveSpecs().map((s) => s.key)).not.toContain('roundGuilds');
  });

  it('takes yes or no and refuses anything else', () => {
    for (const value of [true, false, undefined])
      expect(refused(value)).toBe(0);
    for (const value of ['false', 'true', 0, 1, null, {}, []])
      expect(refused(value)).toBe(1);
  });

  it('is refused exactly when it is not yes or no (property)', () => {
    const value = fc.oneof(fc.boolean(), fc.constant(undefined), fc.anything());
    fc.assert(
      fc.property(value, (v) => {
        expect(refused(v)).toBe(
          v === undefined || typeof v === 'boolean' ? 0 : 1,
        );
      }),
    );
  });
});
