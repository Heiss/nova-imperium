// The places that show the guild chat now (#496).
import { describe, expect, it, vi } from 'vitest';
import {
  guildChatShown,
  onGuildChatShown,
  showGuildChat,
} from './chat-shown.ts';

describe('the guild chat in sight', () => {
  it('is in sight while a place shows it, and a place that comes into sight is a visit', () => {
    const visit = vi.fn();
    onGuildChatShown(visit);
    expect(guildChatShown()).toBe(false);
    showGuildChat('window', true);
    expect(guildChatShown()).toBe(true);
    expect(visit).toHaveBeenCalledOnce();
    // Shown again: no second visit; a second place is one.
    showGuildChat('window', true);
    expect(visit).toHaveBeenCalledOnce();
    showGuildChat('messages', true);
    expect(visit).toHaveBeenCalledTimes(2);
    showGuildChat('window', false);
    expect(guildChatShown()).toBe(true);
    showGuildChat('messages', false);
    expect(guildChatShown()).toBe(false);
    // Hiding is no visit.
    expect(visit).toHaveBeenCalledTimes(2);
  });
});
