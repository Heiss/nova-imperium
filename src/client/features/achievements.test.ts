import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unfolded } from '../logic/achievement-fold.ts';
import { achievementFilter } from '../logic/achievement-filter.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import { clientFeature } from './achievements.ts';
import { fakeCtx } from './test-ctx.ts';

type Item = { hidden: boolean; dataset: Record<string, string> };
type Group = { hidden: boolean; items: Item[] };

let items: Item[];
let groups: Group[];
let listeners: Record<string, (e: unknown) => void>;

const item = (search: string, category = 'a', status = 'open'): Item => ({
  hidden: false,
  dataset: { search, category, status },
});
const group = (...inGroup: Item[]): Group => ({
  hidden: false,
  items: inGroup,
});
const shown = (list: Item[]) => list.map((i) => !i.hidden);

beforeEach(() => {
  forgetForms();
  listeners = {};
  items = [item('erster flug'), item('große flotte', 'b', 'done')];
  groups = [group(items[0]!), group(items[1]!), group()];
  vi.stubGlobal('document', {
    querySelectorAll: (sel: string) =>
      sel === '[data-achievement]'
        ? items
        : groups.map((g) => ({
            get hidden() {
              return g.hidden;
            },
            set hidden(v: boolean) {
              g.hidden = v;
            },
            querySelector: (s: string) =>
              g.items.find((i) => s === '[data-achievement]' || !i.hidden) ??
              null,
          })),
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
  });
  client.ui.view = 'achievements';
  clientFeature.listen!();
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetForms();
});

describe('the claim buttons', () => {
  it('claims an achievement by its id and the daily reward', () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    acts.achievementClaim({ id: 'first-flight' });
    acts.dailyClaim();
    expect(vi.mocked(ctx.act).mock.calls).toEqual([
      ['claimAchievement', { id: 'first-flight' }],
      ['claimDailyReward'],
    ]);
  });
});

describe('the filter of the list', () => {
  it('shows everything without a search, a category and a status', () => {
    clientFeature.afterRender();
    expect(shown(items)).toEqual([true, true]);
    expect(groups.map((g) => g.hidden)).toEqual([false, false, false]);
  });

  it('searches the lower-cased text, trimmed, and hides the group with nothing left', () => {
    achievementFilter.search = '  FLOTTE ';
    clientFeature.afterRender();
    expect(shown(items)).toEqual([false, true]);
    expect(groups.map((g) => g.hidden)).toEqual([true, false, false]);
  });

  it('narrows by category and by status', () => {
    achievementFilter.category = 'b';
    clientFeature.afterRender();
    expect(shown(items)).toEqual([false, true]);
    achievementFilter.category = '';
    achievementFilter.status = 'open';
    clientFeature.afterRender();
    expect(shown(items)).toEqual([true, false]);
  });

  it('runs after a render, a change and a typed search in this view', () => {
    achievementFilter.search = 'flotte';
    listeners.change!({});
    expect(shown(items)).toEqual([false, true]);
    achievementFilter.search = 'flug';
    listeners.input!({ target: { id: 'achievement_search' } });
    expect(shown(items)).toEqual([true, false]);
  });

  it('does not run for another field, nor in another view', () => {
    achievementFilter.search = 'flotte';
    listeners.input!({ target: { id: 'other' } });
    expect(shown(items)).toEqual([true, true]);
    client.ui.view = 'fleet';
    listeners.change!({});
    listeners.input!({ target: { id: 'achievement_search' } });
    clientFeature.afterRender();
    expect(shown(items)).toEqual([true, true]);
  });
});

describe('the folding on a phone (#189)', () => {
  afterEach(() => {
    unfolded.open = false;
    unfolded.claimed = false;
  });

  it('unfolds the group of its button and renders the page again', () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    acts.achFold({ g: 'claimed' });
    expect(unfolded).toEqual({ open: false, claimed: true });
    expect(ctx.render).toHaveBeenCalledTimes(1);
    acts.achFold({ g: 'claimed' });
    expect(unfolded.claimed).toBe(false);
  });

  it('renders again for a group it does not know, and unfolds nothing', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).achFold({});
    expect(unfolded).toEqual({ open: false, claimed: false });
  });
});
