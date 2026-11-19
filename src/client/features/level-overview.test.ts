import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { V } from '../views/common.ts';
import { clientFeature } from './level-overview.ts';

const shown = { P: { id: 'p1' } } as unknown as V;

beforeEach(() => {
  client.shown = shown;
});
afterEach(() => {
  client.shown = null;
  delete client.ui.openLv;
});

describe('the ▤ of the level overview (#187)', () => {
  const levels = () => clientFeature.acts().levels;

  it('unfolds the table of an entry and folds it again', () => {
    levels()({ k: 'metal' });
    expect(client.ui.openLv).toEqual({ metal: true });
    levels()({ k: 'metal' });
    expect(client.ui.openLv).toEqual({ metal: false });
  });

  it('keeps the other entries as they are', () => {
    levels()({ k: 'metal' });
    levels()({ k: 'weapons' });
    levels()({ k: 'metal' });
    expect(client.ui.openLv).toEqual({ metal: false, weapons: true });
  });

  it('renders the list again from a new view state', () => {
    levels()({ k: 'metal' });
    expect(client.shown).toEqual(shown);
    expect(client.shown).not.toBe(shown);
  });

  it('does nothing without an entry', () => {
    levels()({});
    expect(client.ui.openLv).toBeUndefined();
    expect(client.shown).toBe(shown);
  });

  it('does not need a shown view', () => {
    client.shown = null;
    levels()({ k: 'metal' });
    expect(client.ui.openLv).toEqual({ metal: true });
    expect(client.shown).toBeNull();
  });
});
