import { describe, expect, it } from 'vitest';
import { isPushTopic, PUSH_TOPICS } from './push.ts';

describe('push kinds (#192)', () => {
  it('lists every kind that sends a push today and the two of the guild chat', () => {
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
    ]);
  });

  it('knows only its kinds', () => {
    for (const t of PUSH_TOPICS) expect(isPushTopic(t)).toBe(true);
    for (const x of ['messages', 'Buildings', '', null, undefined, 1, ['news']])
      expect(isPushTopic(x)).toBe(false);
  });
});
