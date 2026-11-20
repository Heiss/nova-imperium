import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from '../views/common.ts';
import type { Handler } from './contract.ts';
import { clientFeature } from './fleet.ts';
import { fakeCtx } from './test-ctx.ts';

// The numbers of the cargo are tested with logic/game.ts; here only what a
// handler reads from the form and where it writes.
vi.mock('../logic/game.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../logic/game.ts')>()),
  cargoMax: vi.fn(() => ({ m: 1, c: 2, d: 3 })),
  cargoOne: vi.fn(() => 7),
  fleetPreview: vi.fn(() => null),
}));
vi.mock('../../core/settle.ts', () => ({ settle: vi.fn(() => ({ id: 'p' })) }));

type Input = Record<string, unknown>;
let fields: Record<string, Input>;
let ships: { value: string; dataset?: Record<string, string> }[];
let listeners: Record<string, (e: unknown) => void>;
const calc = vi.fn();

beforeEach(() => {
  calc.mockClear();
  listeners = {};
  ships = [];
  fields = {
    '#t_g': { value: '2' },
    '#t_s': { value: '30' },
    '#t_p': { value: '4' },
    '#t_k': { value: 'moon', querySelector: () => ({ disabled: false }) },
    // The preview writes the target info first: that is one calculation.
    '#t_info': {
      set innerHTML(_html: string) {
        calc();
      },
    },
    '#t_hold': { hidden: false },
    ...Object.fromEntries(
      ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].map((id) => [
        `#${id}`,
        { innerHTML: '' },
      ]),
    ),
    // No mission fits a moon that is not there: the list stays empty, as the stub holds it.
    '#t_m': { value: 'attack', options: [] },
    '#t_h': { value: '' },
    '#t_v': { value: '5' },
    '#c_m': { value: '10' },
    '#c_c': { value: '' },
    '#c_d': { value: '3' },
  };
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
    querySelectorAll: () => ships,
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
  });
  client.ui.view = 'fleet';
  client.ui.ft = { g: 1, s: 1, p: 1, kind: 'planet' };
  client.game = {
    cfg: { galaxies: 4, systems: 100, positions: 15 },
    planet: { id: 'p' },
    me: {},
    galaxy: [],
    players: [],
  } as unknown as GameState;
  client.view = {
    P: { id: 'p', ships: { fighter: 6, probe: 2 } },
  } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
  client.view = null;
});

const acts = (ctx = fakeCtx()): Record<string, Handler> => {
  clientFeature.listen!(ctx);
  return clientFeature.acts(ctx);
};

describe('the ship selection', () => {
  it('fills every field with the ships of its kind on the planet, and calculates', () => {
    ships = [
      { value: '', dataset: { k: 'fighter' } },
      { value: '1', dataset: { k: 'probe' } },
      { value: '1', dataset: { k: 'frigate' } },
    ];
    acts().fall!({});
    expect(ships.map((i) => i.value)).toEqual(['6', '2', '0']);
    expect(calc).toHaveBeenCalledTimes(1);
  });

  it('empties every field, and calculates', () => {
    ships = [
      { value: '6', dataset: { k: 'fighter' } },
      { value: '2', dataset: { k: 'probe' } },
    ];
    acts().fnone!({});
    expect(ships.map((i) => i.value)).toEqual(['', '']);
    expect(calc).toHaveBeenCalledTimes(1);
  });

  it('fills the field of one kind with all of them, or 0 for a kind not there', () => {
    const ctx = fakeCtx();
    acts(ctx).fmax!({ k: 'fighter' });
    acts(ctx).fmax!({ k: 'frigate' });
    expect(ctx.setInput).toHaveBeenNthCalledWith(1, '#f_fighter', 6);
    expect(ctx.setInput).toHaveBeenNthCalledWith(2, '#f_frigate', 0);
    expect(calc).toHaveBeenCalledTimes(2);
  });
});

describe('the cargo', () => {
  it('fills every resource field with its share, and calculates', () => {
    const ctx = fakeCtx();
    acts(ctx).cmax!({});
    expect(ctx.setInput).toHaveBeenCalledTimes(3);
    expect(ctx.setInput).toHaveBeenCalledWith('#c_m', 1);
    expect(ctx.setInput).toHaveBeenCalledWith('#c_c', 2);
    expect(ctx.setInput).toHaveBeenCalledWith('#c_d', 3);
    expect(calc).toHaveBeenCalledTimes(1);
  });

  it('fills the field of one resource with all it can carry, and calculates', () => {
    const ctx = fakeCtx();
    acts(ctx).cone!({ k: 'c' });
    expect(ctx.setInput).toHaveBeenCalledExactlyOnceWith('#c_c', 7);
    expect(calc).toHaveBeenCalledTimes(1);
  });
});

describe('sending, recalling and jumping', () => {
  beforeEach(() => {
    ships = [
      { value: '4', dataset: { k: 'fighter' } },
      { value: '9', dataset: { k: 'probe' } },
      { value: '0', dataset: { k: 'frigate' } },
    ];
  });

  it('sends the form as it is filled in, kept to the ships and the universe', async () => {
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith('send', {
      ships: { fighter: 4, probe: 2 },
      to: { g: 2, s: 30, p: 4, kind: 'moon' },
      mission: 'attack',
      hold: 0,
      // The stay of an expedition (#93); the field is absent here, so 1.
      stay: 1,
      pct: 5,
      cargo: { m: 10, c: 0, d: 3 },
    });
  });

  it('adds the attack union chosen in the form to the order, and forgets the choice once sent (#225)', async () => {
    fields['#t_u'] = { value: 'f9' };
    client.ui.union = 'f9';
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ union: 'f9', mission: 'attack' }),
    );
    expect(client.ui.union).toBeNull();
  });

  it('forgets the target and renders anew once the fleet is on its way', async () => {
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(client.ui.ft).toBeNull();
    expect(ctx.render).toHaveBeenCalledWith(true);
  });

  it('keeps the form when the action did not go through on this place', async () => {
    const ctx = fakeCtx({ actHere: vi.fn(async () => false) });
    await acts(ctx).send!({});
    expect(client.ui.ft).not.toBeNull();
    expect(ctx.render).not.toHaveBeenCalled();
  });

  it('recalls a fleet by its id', () => {
    const ctx = fakeCtx();
    acts(ctx).recall!({ id: 'f1' });
    expect(ctx.act).toHaveBeenCalledWith('recall', { id: 'f1' });
  });

  it('jumps the picked ships to the moon chosen and renders anew', async () => {
    const ctx = fakeCtx();
    fields['#jg_to'] = { value: 'moon-7' };
    await acts(ctx).jump!({});
    expect(ctx.actHere).toHaveBeenCalledWith('jump', {
      to: 'moon-7',
      ships: { fighter: 4, probe: 2 },
    });
    expect(ctx.render).toHaveBeenCalledWith(true);
  });

  it('does not render when the jump did not go through', async () => {
    const ctx = fakeCtx({ actHere: vi.fn(async () => false) });
    await acts(ctx).jump!({});
    expect(ctx.render).not.toHaveBeenCalled();
  });
});

describe('the preview of the form', () => {
  it('is calculated after a render, a change and an input in the fleet view', () => {
    acts();
    clientFeature.afterRender();
    listeners.change!({});
    listeners.input!({ target: { closest: () => ({}) } });
    expect(calc).toHaveBeenCalledTimes(3);
  });

  it('is not calculated in another view', () => {
    acts();
    client.ui.view = 'galaxy';
    clientFeature.afterRender();
    listeners.change!({});
    listeners.input!({ target: { closest: () => ({}) } });
    expect(calc).not.toHaveBeenCalled();
  });

  it('is not calculated for an input outside the main part of the page', () => {
    acts();
    listeners.input!({ target: { closest: () => null } });
    expect(calc).not.toHaveBeenCalled();
  });
});
