// The „?“ of a setting opens its explanation, and closes it again (#358).
import { afterEach, describe, expect, it } from 'vitest';
import { adminExplain } from '../views/admin-explain-state.svelte.ts';
import { clientFeature, toggleExplain } from './admin-explain.ts';

afterEach(() => {
  adminExplain.key = null;
  adminExplain.opener = null;
});

describe('the „?“ of a setting (#358)', () => {
  it('opens the explanation of its setting and remembers itself', () => {
    void clientFeature.acts().adminExplain({
      k: 'speed',
      o: 'axqu_speed',
    } as never);
    expect(adminExplain).toEqual({ key: 'speed', opener: 'axqu_speed' });
  });

  it('closes it when pressed again, and opens another from another „?“', () => {
    toggleExplain('speed', 'axqu_speed');
    toggleExplain('speed', 'axqr_speed');
    expect(adminExplain).toEqual({ key: 'speed', opener: 'axqr_speed' });
    toggleExplain('speed', 'axqr_speed');
    expect(adminExplain).toEqual({ key: null, opener: null });
  });

  it('ignores a „?“ without its key or its id', () => {
    toggleExplain(undefined, 'axqu_speed');
    toggleExplain('speed', undefined);
    expect(adminExplain).toEqual({ key: null, opener: null });
  });
});
