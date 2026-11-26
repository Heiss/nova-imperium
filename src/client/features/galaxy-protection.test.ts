// The (n) of the Sternenkarte comes with the state of the shown system
// (151a): a system without its list loads the state once.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { askProtection, clientFeature } from './galaxy.ts';
import { fakeCtx } from './test-ctx.ts';

vi.stubGlobal('document', { addEventListener: vi.fn() });

function start(): ReturnType<typeof fakeCtx> {
  const ctx = fakeCtx();
  clientFeature.listen(ctx);
  return ctx;
}

const show = (gal: number, sys: number, list?: object): void => {
  client.game = { me: { id: 'u1' }, protectedOwners: list } as never;
  client.ui.view = 'galaxy';
  client.ui.gal = gal;
  client.ui.sys = sys;
};

afterEach(() => {
  client.game = null;
  client.ui.view = 'overview';
  askProtection();
});

describe('the list of the noob protection of the shown system (151a)', () => {
  it('loads the state once for a system without its list', () => {
    const ctx = start();
    show(1, 2);
    askProtection();
    askProtection();
    expect(ctx.refresh).toHaveBeenCalledTimes(1);
    // The list of another system does not count for this one.
    show(1, 2, { g: 1, s: 3, owners: [] });
    askProtection();
    expect(ctx.refresh).toHaveBeenCalledTimes(1);
    // Another system: once more.
    show(1, 3, { g: 1, s: 2, owners: [] });
    askProtection();
    expect(ctx.refresh).toHaveBeenCalledTimes(2);
  });

  it('loads nothing when the list is there, or outside the Sternenkarte', () => {
    const ctx = start();
    show(1, 2, { g: 1, s: 2, owners: ['u2'] });
    askProtection();
    client.ui.view = 'overview';
    askProtection();
    expect(ctx.refresh).not.toHaveBeenCalled();
    // Back on the map after another view, a system without its list loads.
    show(1, 4, { g: 1, s: 2, owners: ['u2'] });
    askProtection();
    expect(ctx.refresh).toHaveBeenCalledTimes(1);
    // Without a state nothing.
    client.game = null;
    askProtection();
    expect(ctx.refresh).toHaveBeenCalledTimes(1);
  });

  it('asks again for the same system after the player left the map', () => {
    const ctx = start();
    show(1, 2);
    askProtection();
    client.ui.view = 'overview';
    askProtection();
    show(1, 2);
    askProtection();
    expect(ctx.refresh).toHaveBeenCalledTimes(2);
  });
});
