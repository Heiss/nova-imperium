import { beforeEach, describe, expect, it } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { clientFeature } from './highscore.ts';
import { fakeCtx } from './test-ctx.ts';

beforeEach(() => {
  client.ui.highscore = 'total';
});

describe('the categories of the Bestenliste', () => {
  it('shows the category of the button and renders without dropping drafts', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).highscore({ cat: 'military' });
    expect(client.ui.highscore).toBe('military');
    expect(ctx.render).toHaveBeenCalledExactlyOnceWith();
  });

  it('falls back to the total for a name it does not know, also an old category (#422)', () => {
    for (const cat of ['nonsense', 'research']) {
      client.ui.highscore = 'economy';
      clientFeature.acts(fakeCtx()).highscore({ cat });
      expect(client.ui.highscore).toBe('total');
    }
  });
});
