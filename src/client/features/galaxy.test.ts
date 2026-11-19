import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from '../views/common.ts';
import type { Handler } from './contract.ts';
import { clientFeature } from './galaxy.ts';
import { fakeCtx } from './test-ctx.ts';

type Field = { value?: string; focus?: () => void };
let fields: Record<string, Field>;
let keydown: (e: { key: string; target: { id: string } }) => void;

beforeEach(() => {
  fields = {};
  vi.stubGlobal('CSS', { escape: (s: string) => s });
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
    addEventListener: (type: string, fn: typeof keydown) => {
      if (type === 'keydown') keydown = fn;
    },
  });
  Object.assign(client.ui, {
    gal: 2,
    sys: 5,
    gmoon: null,
    scan: null,
    ft: null,
  });
  client.game = {
    cfg: { galaxies: 4, systems: 10 },
    mainPlanet: 'home',
    me: { probes: 3 },
    galaxy: [{ id: 'home', g: 3, s: 7 }],
  } as unknown as GameState;
  client.view = {
    P: { id: 'here', g: 1, s: 1, ships: { probe: 5 } },
  } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
  client.view = null;
});

const acts = (ctx = fakeCtx()): Record<string, Handler> =>
  clientFeature.acts(ctx);

describe('stepping through the map', () => {
  it('steps by the arrows and renders anew', () => {
    const ctx = fakeCtx();
    acts(ctx).gnav!({ d: 'g+' });
    expect(client.ui).toMatchObject({ gal: 3, sys: 5 });
    acts(ctx).gnav!({ d: 's-' });
    expect(client.ui).toMatchObject({ gal: 3, sys: 4 });
    expect(ctx.render).toHaveBeenCalledTimes(2);
    expect(ctx.render).toHaveBeenCalledWith(true);
  });

  it('stays where it is for an unknown direction', () => {
    acts().gnav!({});
    expect(client.ui).toMatchObject({ gal: 2, sys: 5 });
  });

  it('goes to the galaxy and system typed, kept inside the universe', () => {
    const ctx = fakeCtx();
    fields['#g_g'] = { value: '9' };
    fields['#g_s'] = { value: '0' };
    acts(ctx).ggo!({});
    expect(client.ui).toMatchObject({ gal: 4, sys: 1 });
    expect(ctx.render).toHaveBeenCalledWith(true);
  });

  it('goes to the main planet, else to the shown one', () => {
    const ctx = fakeCtx();
    acts(ctx).ghome!({});
    expect(client.ui).toMatchObject({ gal: 3, sys: 7 });
    client.game!.mainPlanet = 'gone';
    acts(ctx).ghome!({});
    expect(client.ui).toMatchObject({ gal: 1, sys: 1 });
    expect(ctx.render).toHaveBeenCalledTimes(2);
  });

  it('goes to a position and shows the map', () => {
    const ctx = fakeCtx();
    acts(ctx).gto!({ g: '2', s: '11' });
    expect(client.ui).toMatchObject({ gal: 2, sys: 11 });
    expect(ctx.go).toHaveBeenCalledWith('galaxy');
  });

  it('goes to the position typed on Enter in a field of the position only', () => {
    const ctx = fakeCtx();
    acts(ctx);
    fields['#g_g'] = { value: '3' };
    fields['#g_s'] = { value: '8' };
    keydown({ key: 'Enter', target: { id: 'g_g' } });
    expect(client.ui).toMatchObject({ gal: 3, sys: 8 });
    expect(ctx.render).toHaveBeenCalledTimes(1);
    keydown({ key: 'Enter', target: { id: 'other' } });
    keydown({ key: 'a', target: { id: 'g_s' } });
    expect(ctx.render).toHaveBeenCalledTimes(1);
  });
});

describe('what a planet of the map offers', () => {
  it('opens and closes the moon of a planet', () => {
    const ctx = fakeCtx();
    acts(ctx).gmoon!({ id: 'p1' });
    expect(client.ui.gmoon).toBe('p1');
    acts(ctx).gmoon!({ id: 'p1' });
    expect(client.ui.gmoon).toBeNull();
    acts(ctx).gmoon!({});
    expect(client.ui.gmoon).toBeNull();
    expect(ctx.render).toHaveBeenCalledTimes(3);
  });

  it('shows the scan and moves the focus to its heading once it went through', async () => {
    const ctx = fakeCtx();
    const focus = vi.fn();
    fields['#scan-h'] = { focus };
    await acts(ctx).gscan!({ id: 'p1' });
    expect(ctx.actHere).toHaveBeenCalledWith('scan', { target: 'p1' });
    expect(ctx.render).toHaveBeenCalledWith(true);
    expect(focus).toHaveBeenCalled();
  });

  it('shows nothing when the scan did not go through on this place', async () => {
    const ctx = fakeCtx({ actHere: vi.fn(async () => false) });
    const focus = vi.fn();
    fields['#scan-h'] = { focus };
    await acts(ctx).gscan!({ id: 'p1' });
    expect(ctx.render).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('closes the scan and focuses its button while the planet is shown', () => {
    const ctx = fakeCtx();
    const focus = vi.fn();
    client.ui.scan = { target: 'p1' } as never;
    fields['[data-act=gscan][data-id="p1"]'] = { focus };
    acts(ctx).gscanClose!({});
    expect(client.ui.scan).toBeNull();
    expect(ctx.render).toHaveBeenCalledWith(true);
    expect(focus).toHaveBeenCalled();
  });

  it('closes a scan that has no target without a focus', () => {
    const ctx = fakeCtx();
    acts(ctx).gscanClose!({});
    expect(client.ui.scan).toBeNull();
    expect(ctx.render).toHaveBeenCalledWith(true);
  });

  it('opens the fleet form for the target with its mission, attack by default', () => {
    const ctx = fakeCtx();
    acts(ctx).gfleet!({ g: '2', s: '3', p: '4' });
    expect(client.ui.ft).toEqual({ g: 2, s: 3, p: 4, kind: 'planet' });
    expect(client.ui.fm).toBe('attack');
    acts(ctx).gfleet!({ g: '2', s: '3', p: '4', m: 'spy' });
    expect(client.ui.fm).toBe('spy');
    expect(ctx.go).toHaveBeenCalledWith('fleet');
  });
});

describe('a spy probe from the map', () => {
  it('sends as many probes as the player sets, at most those on the planet', () => {
    const ctx = fakeCtx();
    acts(ctx).gspy!({ g: '2', s: '3', p: '4' });
    expect(ctx.act).toHaveBeenCalledWith('send', {
      ships: { probe: 3 },
      to: { g: 2, s: 3, p: 4, kind: 'planet' },
      mission: 'spy',
      pct: 10,
      cargo: { m: 0, c: 0, d: 0 },
    });
  });

  it('sends one probe when the player set none, and the mission asked for', () => {
    const ctx = fakeCtx();
    client.game!.me.probes = 0;
    acts(ctx).gspy!({ g: '2', s: '3', p: '4', m: 'phalanx' });
    expect(ctx.act).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ ships: { probe: 1 }, mission: 'phalanx' }),
    );
  });

  it('says so when there is no probe on the planet', () => {
    const ctx = fakeCtx();
    client.view!.P.ships = {};
    acts(ctx).gspy!({ g: '2', s: '3', p: '4' });
    expect(ctx.toast).toHaveBeenCalledWith(
      'Keine Spähschädel auf dem Planeten.',
      true,
    );
    expect(ctx.act).not.toHaveBeenCalled();
  });
});
