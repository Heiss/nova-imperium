import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  assembleTopics,
  GUILD_PUSH_TOPICS,
  isPushTopic,
  PUSH_TOPICS,
  pushTopicLabel,
  type PushTopic,
} from './push.ts';
import { PUSH_TOPIC_LISTS } from './push-topics/topics.gen.ts';

describe('push kinds (#192)', () => {
  it('lists every kind that sends a push today the two of the guild chat and the private messages', () => {
    expect(PUSH_TOPICS).toEqual([
      'buildings',
      'research',
      'shipyard',
      'fleet',
      'attacked',
      'spied',
      'delivery',
      'announcement',
      'news',
      'guild-events',
      'guild-chat',
      'private-messages',
    ]);
  });

  it('knows only its kinds', () => {
    for (const t of PUSH_TOPICS) expect(isPushTopic(t)).toBe(true);
    for (const x of ['messages', 'Buildings', '', null, undefined, 1, ['news']])
      expect(isPushTopic(x)).toBe(false);
  });

  it('names the two kinds of the guild chat (#169)', () => {
    expect(GUILD_PUSH_TOPICS).toEqual(['guild-events', 'guild-chat']);
  });
});

describe('the push kinds register themselves (#426)', () => {
  const entry = (key: string, order: number, guild?: boolean) => ({
    key,
    order,
    label: key,
    ...(guild === undefined ? {} : { guild }),
  });

  it('is a type of exactly the twelve kinds, not any string', () => {
    expectTypeOf<PushTopic>().toEqualTypeOf<
      | 'buildings'
      | 'research'
      | 'shipyard'
      | 'fleet'
      | 'attacked'
      | 'spied'
      | 'delivery'
      | 'announcement'
      | 'news'
      | 'guild-events'
      | 'guild-chat'
      | 'private-messages'
    >();
  });

  it('sorts the kinds of all files by their order, not by the files', () => {
    expect(
      assembleTopics([
        ['b', [entry('x', 30), entry('y', 10)]],
        ['a', [entry('z', 20, true)]],
      ]).map((t) => t.key),
    ).toEqual(['y', 'z', 'x']);
    expect(assembleTopics([])).toEqual([]);
  });

  it('stops at a key or an order defined twice and names both files', () => {
    expect(() =>
      assembleTopics([
        ['a', [entry('x', 10)]],
        ['b', [entry('x', 20)]],
      ]),
    ).toThrow(
      'Push kind key x is defined twice: in src/core/push-topics/a.ts and in src/core/push-topics/b.ts.',
    );
    expect(() =>
      assembleTopics([
        ['a', [entry('x', 10)]],
        ['b', [entry('y', 10)]],
      ]),
    ).toThrow(
      'Push kind order 10 is defined twice: in src/core/push-topics/a.ts and in src/core/push-topics/b.ts.',
    );
  });

  it('stops at a kind without an order', () => {
    for (const order of [Number.NaN, Infinity, undefined])
      expect(() =>
        assembleTopics([['a', [entry('x', order as number)]]]),
      ).toThrow('Push kind x in src/core/push-topics/a.ts has no order.');
  });

  it('marks the guild kinds by their entry and gives every kind its label', () => {
    type Entry = { key: PushTopic; label: string; guild?: boolean };
    const entries = PUSH_TOPIC_LISTS.flatMap(
      ([, topics]): readonly Entry[] => topics,
    );
    expect(entries.map((t) => t.key).sort()).toEqual([...PUSH_TOPICS].sort());
    for (const t of entries) {
      expect(pushTopicLabel(t.key)).toBe(t.label);
      expect(t.label.trim()).not.toBe('');
    }
    expect(entries.filter((t) => t.guild === true).map((t) => t.key)).toEqual([
      ...GUILD_PUSH_TOPICS,
    ]);
    expect(pushTopicLabel('guild-chat')).toBe('Nachrichten im Gilden-Chat');
  });
});
