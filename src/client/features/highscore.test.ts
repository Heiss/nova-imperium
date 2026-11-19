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
    clientFeature.acts(ctx).highscore({ cat: 'research' });
    expect(client.ui.highscore).toBe('research');
    expect(ctx.render).toHaveBeenCalledExactlyOnceWith();
  });

  it('falls back to the total for a name it does not know', () => {
    client.ui.highscore = 'research';
    clientFeature.acts(fakeCtx()).highscore({ cat: 'nonsense' });
    expect(client.ui.highscore).toBe('total');
  });
});
