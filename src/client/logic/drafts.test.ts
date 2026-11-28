import { afterEach, describe, expect, it } from 'vitest';
import { drafts } from './drafts.svelte.ts';

afterEach(() => drafts.reset(true));

describe('the drafts of the fields', () => {
  it('keeps what was typed per field and gives the empty string for none', () => {
    expect(drafts.get('guildChat')).toBe('');
    drafts.set('guildChat', 'Hallo');
    drafts.set('friendName', 'Anna');
    expect(drafts.get('guildChat')).toBe('Hallo');
    expect(drafts.get('friendName')).toBe('Anna');
  });

  it('takes the newest text and treats an emptied field as no draft', () => {
    drafts.set('guildChat', 'a');
    drafts.set('guildChat', 'ab');
    expect(drafts.get('guildChat')).toBe('ab');
    drafts.set('guildChat', '');
    expect(drafts.get('guildChat')).toBe('');
  });

  it('clears one field or all of them', () => {
    drafts.set('guildChat', 'a');
    drafts.set('friendName', 'b');
    drafts.clear('guildChat');
    expect(drafts.get('guildChat')).toBe('');
    expect(drafts.get('friendName')).toBe('b');
    drafts.reset();
    expect(drafts.get('friendName')).toBe('');
  });

  it('keeps the draft of the chat window over a change of the view, not over a logout (#496)', () => {
    drafts.set('windowChat', 'Fenster');
    drafts.set('guildChat', 'Seite');
    drafts.reset();
    expect(drafts.get('windowChat')).toBe('Fenster');
    expect(drafts.get('guildChat')).toBe('');
    drafts.reset(true);
    expect(drafts.get('windowChat')).toBe('');
  });
});
