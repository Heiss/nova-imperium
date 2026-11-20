// The filter of the phone lists is kept per device (#189): the module reads
// the storage once when it loads and writes on every choice; a blocked storage
// (private window, blocked site data) neither breaks the start nor the choice.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTER_KEY } from './phone-build.ts';

/** A fresh module, so its first read of the storage runs again. */
async function load() {
  vi.resetModules();
  return import('./phone-build.svelte.ts');
}

let kept: Map<string, string>;

beforeEach(() => {
  kept = new Map();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const store = (): void => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  });
};

/** A storage that throws on every access, as a blocked one does. */
const blocked = (): void => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
};

describe('the filter of the phone lists over a reload', () => {
  it('starts with „Baubar“ on a device that kept nothing', async () => {
    store();
    expect((await load()).phoneBuild.filter).toBe('open');
  });

  it('keeps a choice: the next load reads it', async () => {
    store();
    (await load()).chooseFilter('running');
    expect(kept.get(FILTER_KEY)).toBe('running');
    expect((await load()).phoneBuild.filter).toBe('running');
    (await load()).chooseFilter('all');
    expect((await load()).phoneBuild.filter).toBe('all');
  });

  it('changes the filter at once and leaves the unfolded rows alone', async () => {
    store();
    const m = await load();
    m.phoneBuild.unfolded.metal = true;
    m.chooseFilter('all');
    expect(m.phoneBuild.filter).toBe('all');
    expect(m.phoneBuild.unfolded).toEqual({ metal: true });
  });

  it('ignores a stored value that is no filter', async () => {
    store();
    kept.set(FILTER_KEY, 'everything');
    expect((await load()).phoneBuild.filter).toBe('open');
  });

  it('works without a storage: the choice lasts until the page is reloaded', async () => {
    blocked();
    const m = await load();
    expect(m.phoneBuild.filter).toBe('open');
    expect(() => m.chooseFilter('running')).not.toThrow();
    expect(m.phoneBuild.filter).toBe('running');
  });

  it('works where there is no storage object at all', async () => {
    const m = await load();
    expect(m.phoneBuild.filter).toBe('open');
    expect(() => m.chooseFilter('all')).not.toThrow();
    expect(m.phoneBuild.filter).toBe('all');
  });
});
