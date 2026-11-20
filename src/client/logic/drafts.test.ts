import { afterEach, describe, expect, it } from 'vitest';
import { drafts, FRIEND_NAME, GUILD_CHAT } from './drafts.svelte.ts';

afterEach(() => drafts.reset());

describe('the drafts of the fields', () => {
  it('keeps what was typed per field and gives the empty string for none', () => {
    expect(drafts.get(GUILD_CHAT)).toBe('');
    drafts.set(GUILD_CHAT, 'Hallo');
    drafts.set(FRIEND_NAME, 'Anna');
    expect(drafts.get(GUILD_CHAT)).toBe('Hallo');
    expect(drafts.get(FRIEND_NAME)).toBe('Anna');
  });

  it('takes the newest text and treats an emptied field as no draft', () => {
    drafts.set(GUILD_CHAT, 'a');
    drafts.set(GUILD_CHAT, 'ab');
    expect(drafts.get(GUILD_CHAT)).toBe('ab');
    drafts.set(GUILD_CHAT, '');
    expect(drafts.get(GUILD_CHAT)).toBe('');
  });

  it('clears one field or all of them', () => {
    drafts.set(GUILD_CHAT, 'a');
    drafts.set(FRIEND_NAME, 'b');
    drafts.clear(GUILD_CHAT);
    expect(drafts.get(GUILD_CHAT)).toBe('');
    expect(drafts.get(FRIEND_NAME)).toBe('b');
    drafts.reset();
    expect(drafts.get(FRIEND_NAME)).toBe('');
  });
});
