import { describe, expect, it } from 'vitest';
import { GUILD_PUSH_TOPICS, isPushTopic, PUSH_TOPICS } from './push.ts';

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
