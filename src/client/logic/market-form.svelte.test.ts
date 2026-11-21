import { afterEach, describe, expect, it } from 'vitest';
import { chooseGive, draft } from './market-form.svelte.ts';
import { newDraft } from './market.ts';

afterEach(() => Object.assign(draft, newDraft()));

describe('the state of the form of the marketplace', () => {
  it('starts with Adamant for Psikristall and no amount', () => {
    expect(draft).toEqual({ give: 'm', get: 'c', amount: '' });
  });

  it('keeps what to get while it differs from what is given, and the amount', () => {
    draft.amount = '250';
    chooseGive('d');
    expect(draft).toEqual({ give: 'd', get: 'c', amount: '250' });
  });

  it('never gets what it gives: the first other resource then', () => {
    chooseGive('c');
    expect(draft).toEqual({ give: 'c', get: 'm', amount: '' });
    draft.get = 'd';
    chooseGive('d');
    expect(draft).toEqual({ give: 'd', get: 'm', amount: '' });
  });
});
