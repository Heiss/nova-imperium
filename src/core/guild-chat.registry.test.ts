// The events of the guild chat register themselves (#426 part 6).
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
