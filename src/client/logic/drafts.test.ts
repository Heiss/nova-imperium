import { afterEach, describe, expect, it } from 'vitest';
import { drafts } from './drafts.svelte.ts';

afterEach(() => drafts.reset());

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
});
