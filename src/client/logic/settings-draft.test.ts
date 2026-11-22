import { describe, expect, it } from 'vitest';
import {
  draftOwner,
  draftsOf,
  forgetDrafts,
  newDraft,
  typed,
} from './settings-draft.ts';

describe('the draft of the settings', () => {
  it('starts empty and belongs to no account', () => {
    expect(newDraft()).toEqual({ owner: '', values: new Map() });
  });

  it('holds what was typed, by the key of the setting', () => {
    const draft = newDraft();
    typed(draft, 'u_a/1', 'speed', '7', '5');
    typed(draft, 'u_a/1', 'systems', '60', '40');
    expect([...draftsOf(draft, 'u_a/1')]).toEqual([
      ['speed', '7'],
      ['systems', '60'],
    ]);
  });

  it('drops a field that is set back to the saved value', () => {
    const draft = newDraft();
    typed(draft, 'u_a/1', 'speed', '7', '5');
    typed(draft, 'u_a/1', 'speed', '5', '5');
    expect(draftsOf(draft, 'u_a/1').size).toBe(0);
  });

  it('drops the drafts of another account or round', () => {
    const draft = newDraft();
    typed(draft, 'u_a/1', 'speed', '7', '5');
    expect(draftsOf(draft, 'u_a/2').size).toBe(0);
    typed(draft, 'u_a/2', 'speed', '8', '5');
    expect(draftsOf(draft, 'u_b/2').size).toBe(0);
  });

  it('forgets everything once saved', () => {
    const draft = newDraft();
    typed(draft, 'u_a/1', 'speed', '7', '5');
    forgetDrafts(draft);
    expect(draftsOf(draft, 'u_a/1').size).toBe(0);
  });
});

describe('the owner of a draft (review of #347)', () => {
  it('is the account and the round, another round is another owner', () => {
    expect(draftOwner({ me: { id: 'u_a' }, round: { number: 3 } })).toBe(
      'u_a/3',
    );
    expect(draftOwner({ me: { id: 'u_a' }, round: { number: 4 } })).not.toBe(
      draftOwner({ me: { id: 'u_a' }, round: { number: 3 } }),
    );
  });

  it('names a state without the account or without the round by an empty part', () => {
    expect(draftOwner({})).toBe('/');
    expect(draftOwner({ me: { id: 'u_a' } })).toBe('u_a/');
    expect(draftOwner({ round: { number: 3 } })).toBe('/3');
  });
});
