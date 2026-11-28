// The places of the guild chat and their ids (#496).
import { describe, expect, it } from 'vitest';
import { chatDraft, chatIds, chatPlaceOf } from './chat-place.ts';

describe('the places of the guild chat', () => {
  it('keeps the ids of the page of the guild, and gives each other place its own', () => {
    expect(chatIds('guild')).toEqual({
      form: 'guildchatform',
      field: 'chat_text',
    });
    expect(chatIds('messages')).toEqual({
      form: 'guildchatform-messages',
      field: 'chat_text-messages',
    });
    expect(chatIds('window')).toEqual({
      form: 'guildchatform-window',
      field: 'chat_text-window',
    });
  });

  it('finds the place of a form by its id, and none for another form', () => {
    for (const place of ['guild', 'messages', 'window'] as const)
      expect(chatPlaceOf(chatIds(place).form)).toBe(place);
    expect(chatPlaceOf('friendform')).toBeNull();
    expect(chatPlaceOf('guildchatform-x')).toBeNull();
  });

  it('gives the window a draft of its own', () => {
    expect(chatDraft('window')).toBe('windowChat');
    expect(chatDraft('guild')).toBe('guildChat');
    expect(chatDraft('messages')).toBe('guildChat');
  });
});
