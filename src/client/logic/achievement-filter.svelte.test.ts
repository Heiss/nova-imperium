import { afterEach, describe, expect, it } from 'vitest';
import {
  achievementFilter,
  groupHides,
  hides,
  type AchievementFilter,
} from './achievement-filter.svelte.ts';
import { forgetForms } from './form-state.svelte.ts';

afterEach(forgetForms);

const none: AchievementFilter = { search: '', category: '', status: '' };
const entry = { category: 'fleet', status: 'open', search: 'erster flug' };

describe('the state of the filter', () => {
  it('starts empty and a fresh render drops what was typed', () => {
    expect(achievementFilter).toEqual(none);
    achievementFilter.search = 'flug';
    achievementFilter.category = 'fleet';
    achievementFilter.status = 'open';
    forgetForms();
    expect(achievementFilter).toEqual(none);
  });
});

describe('what the filter hides', () => {
  it('hides nothing without a search, a category and a status', () => {
    expect(hides(none, entry)).toBe(false);
  });

  it('searches the lower-cased text, trimmed', () => {
    expect(hides({ ...none, search: '  FLUG ' }, entry)).toBe(false);
    expect(hides({ ...none, search: 'flotte' }, entry)).toBe(true);
  });

  it('narrows by category and by status, each alone', () => {
    expect(hides({ ...none, category: 'fleet' }, entry)).toBe(false);
    expect(hides({ ...none, category: 'build' }, entry)).toBe(true);
    expect(hides({ ...none, status: 'open' }, entry)).toBe(false);
    expect(hides({ ...none, status: 'claimed' }, entry)).toBe(true);
  });

  it('hides a group that has entries and none is left', () => {
    expect(groupHides(true, false)).toBe(true);
    expect(groupHides(true, true)).toBe(false);
    expect(groupHides(false, false)).toBe(false);
    expect(groupHides(false, true)).toBe(false);
  });
});
