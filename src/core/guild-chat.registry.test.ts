// The events of the guild chat register themselves (#426 part 6).
import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  assembleEvents,
  CHAT_EVENTS,
  type ChatEventKind,
  chatEventText,
} from './guild-chat.ts';
import { CHAT_EVENT_LISTS } from './chat-events/events.gen.ts';

const entry = (key: string, order: number) => ({
  key,
  order,
  sentence: () => key,
});

describe('the chat events register themselves (#426)', () => {
  it('is a type of exactly the five events, not any string', () => {
    expectTypeOf<ChatEventKind>().toEqualTypeOf<
      'join' | 'leave' | 'remove' | 'rank' | 'attack'
    >();
  });

  it('sorts the events of all files by their order, not by the files', () => {
    expect(
      assembleEvents([
        ['b', [entry('x', 30), entry('y', 10)]],
        ['a', [entry('z', 20)]],
      ]).map((e) => e.key),
    ).toEqual(['y', 'z', 'x']);
    expect(assembleEvents([])).toEqual([]);
  });

  it('stops at a key or an order defined twice and names both files', () => {
    expect(() =>
      assembleEvents([
        ['a', [entry('x', 10)]],
        ['b', [entry('x', 20)]],
      ]),
    ).toThrow(
      'Chat event key x is defined twice: in src/core/chat-events/a.ts and in src/core/chat-events/b.ts.',
    );
    expect(() =>
      assembleEvents([
        ['a', [entry('x', 10)]],
        ['b', [entry('y', 10)]],
      ]),
    ).toThrow(
      'Chat event order 10 is defined twice: in src/core/chat-events/a.ts and in src/core/chat-events/b.ts.',
    );
  });

  it('stops at an event without an order', () => {
    for (const order of [Number.NaN, Infinity, undefined])
      expect(() =>
        assembleEvents([['a', [entry('x', order as number)]]]),
      ).toThrow('Chat event x in src/core/chat-events/a.ts has no order.');
  });

  it('stops at an empty key and at the key of the messages', () => {
    expect(() => assembleEvents([['a', [entry('', 10)]]])).toThrow(
      'A chat event in src/core/chat-events/a.ts has an empty key.',
    );
    expect(() => assembleEvents([['b', [entry('message', 10)]]])).toThrow(
      'Chat event message in src/core/chat-events/b.ts takes the kind of the messages.',
    );
  });

  it('writes a kind it does not know as the rank, as before #426: the log never breaks', () => {
    const unknown = { kind: 'gone' as ChatEventKind, name: 'lea', text: 'X' };
    expect(chatEventText(unknown, '20:15')).toBe('Lea ist jetzt X.');
    expect(chatEventText({ ...unknown, name: null }, '')).toBe(
      'Ehemaliges Mitglied ist jetzt X.',
    );
  });

  it('writes the line of every kind from its own entry', () => {
    const files = CHAT_EVENT_LISTS.flatMap(([file, events]) =>
      events.map((e) => [e.key, file] as const),
    );
    expect(Object.fromEntries(files)).toEqual({
      join: 'membership',
      leave: 'membership',
      remove: 'membership',
      rank: 'rank',
      attack: 'attack',
    });
    expect(files.map(([key]) => key).sort()).toEqual([...CHAT_EVENTS].sort());
    expect(
      chatEventText({ kind: 'rank', name: 'lea', text: 'Offizier' }, '20:15'),
    ).toBe('Lea ist jetzt Offizier.');
  });
});

/**
 * frozen: chatEventText of src/core/guild-chat.ts before #426 part 6, the
 * sentences written out by kind, with the rank as the fallback.
 */
function before(
  e: {
    kind: string;
    name: string | null;
    text: string;
    attacker?: string | null;
  },
  arrival: string,
): string {
  const name = e.name ?? 'ehemaliges Mitglied';
  if (e.kind === 'attack')
    return `⚔ Angriff auf ${e.text} (${e.attacker ?? 'Unbekannt'} → ${name}), Ankunft ${arrival}`;
  const who = name.charAt(0).toUpperCase() + name.slice(1);
  if (e.kind === 'join') return `${who} ist der Gilde beigetreten.`;
  if (e.kind === 'leave') return `${who} hat die Gilde verlassen.`;
  if (e.kind === 'remove') return `${who} wurde aus der Gilde entfernt.`;
  return `${who} ist jetzt ${e.text}.`;
}

describe('the lines of the chat events against the code before #426', () => {
  it('are the same, byte for byte, for every kind, a kind it does not know too', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHAT_EVENTS, 'gone', ''),
        fc.option(fc.string(), { nil: null }),
        fc.string(),
        fc.option(fc.option(fc.string(), { nil: null }), { nil: undefined }),
        fc.string(),
        (kind, name, text, attacker, arrival) => {
          const e = {
            kind: kind as ChatEventKind,
            name,
            text,
            ...(attacker === undefined ? {} : { attacker }),
          };
          expect(chatEventText(e, arrival)).toBe(before(e, arrival));
        },
      ),
      { seed: 426, numRuns: 500 },
    );
  });
});
