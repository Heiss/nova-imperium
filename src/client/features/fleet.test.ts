import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from '../views/common.ts';
import type { Handler } from './contract.ts';
import { clientFeature } from './fleet.ts';
import { fakeCtx } from './test-ctx.ts';

// The numbers of the cargo are tested with logic/game.ts; here only what a
// handler reads from the form and where it writes. The ships, the position,
// the speed and the cargo are the state of the form (#332).
vi.mock('../logic/game.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../logic/game.ts')>()),
  cargoMax: vi.fn(() => ({ m: 1, c: 2, d: 3 })),
  cargoOne: vi.fn(() => 7),
  fleetPreview: vi.fn(() => null),
}));
vi.mock('../../core/settle.ts', () => ({ settle: vi.fn(() => ({ id: 'p' })) }));

type Input = Record<string, unknown>;
const moon = (g: number, s: number, p: number) => ({
  id: `m${g}_${s}_${p}`,
  kind: 'moon',
  name: 'Mond',
  g,
  s,
  p,
  temp: 1,
  owner: 'u2',
});
let fields: Record<string, Input>;
/** The ship fields the view lists, by their kind. */
let ships: { dataset: Record<string, string> }[];
let listeners: Record<string, (e: unknown) => void>;
const calc = vi.fn();

beforeEach(() => {
  calc.mockClear();
  listeners = {};
  ships = [];
  Object.assign(fleetForm, {
    to: { g: '2', s: '30', p: '4' },
    speed: '5',
    cargo: { m: '10', c: '', d: '3' },
    kind: 'moon',
    mission: 'attack',
    hold: '4',
  });
  fields = {
    // The form is on the page.
    '#t_g': {},
    // The preview writes the target info first: that is one calculation.
    '#t_info': {
      set innerHTML(_html: string) {
        calc();
      },
    },
    ...Object.fromEntries(
      ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].map((id) => [
        `#${id}`,
        { innerHTML: '' },
      ]),
    ),
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
    me: { id: 'u1', research: {} },
    fleets: [],
    debris: [],
    // A moon at the target of the tests (and at the page's, 3:12:9): the kind „Mond“ holds there only.
    galaxy: [moon(2, 30, 4), moon(3, 12, 9)],
    players: [],
  } as unknown as GameState;
  client.view = {
    P: { id: 'p', g: 1, s: 1, p: 1, ships: { fighter: 6, probe: 2 } },
    ui: client.ui,
  } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetForms();
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
      { dataset: { k: 'fighter' } },
      { dataset: { k: 'probe' } },
      { dataset: { k: 'frigate' } },
    ];
    fleetForm.ships = { probe: '1', frigate: '1' };
    acts().fall!({});
    expect(fleetForm.ships).toEqual({ fighter: '6', probe: '2', frigate: '0' });
    expect(calc).toHaveBeenCalledTimes(1);
  });

  it('empties every field, and calculates', () => {
    ships = [{ dataset: { k: 'fighter' } }, { dataset: { k: 'probe' } }];
    fleetForm.ships = { fighter: '6', probe: '2' };
    acts().fnone!({});
    expect(fleetForm.ships).toEqual({ fighter: '', probe: '' });
    expect(calc).toHaveBeenCalledTimes(1);
  });

  it('fills the field of one kind with all of them, or 0 for a kind not there', () => {
    const ctx = fakeCtx();
    acts(ctx).fmax!({ k: 'fighter' });
    acts(ctx).fmax!({ k: 'frigate' });
    expect(fleetForm.ships).toEqual({ fighter: '6', frigate: '0' });
    expect(ctx.setInput).not.toHaveBeenCalled();
    expect(calc).toHaveBeenCalledTimes(2);
  });
});

describe('the cargo', () => {
  it('fills every resource field with its share, and calculates', () => {
    const ctx = fakeCtx();
    acts(ctx).cmax!({});
    expect(fleetForm.cargo).toEqual({ m: '1', c: '2', d: '3' });
    expect(ctx.setInput).not.toHaveBeenCalled();
    expect(calc).toHaveBeenCalledTimes(1);
  });

  it('fills the field of one resource with all it can carry, and calculates', () => {
    const ctx = fakeCtx();
    acts(ctx).cone!({ k: 'c' });
    expect(fleetForm.cargo).toEqual({ m: '10', c: '7', d: '3' });
    expect(calc).toHaveBeenCalledTimes(1);
  });
});

describe('the fields the player did not touch', () => {
  it('send the target of the page, the first speed and no cargo', async () => {
    forgetForms();
    client.ui.ft = { g: 3, s: 12, p: 9, kind: 'moon' };
    fleetForm.ships = { fighter: '1' };
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        to: { g: 3, s: 12, p: 9, kind: 'moon' },
        pct: 10,
        cargo: { m: 0, c: 0, d: 0 },
      }),
    );
  });

  it('send the shown planet while no target was chosen elsewhere', async () => {
    forgetForms();
    client.ui.ft = null;
    client.view = {
      ...client.view!,
      P: { ...client.view!.P, g: 2, s: 7, p: 11 },
    } as V;
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ to: { g: 2, s: 7, p: 11, kind: 'planet' } }),
    );
  });
});

describe('sending, recalling and jumping', () => {
  beforeEach(() => {
    fleetForm.ships = { fighter: '4', probe: '9', frigate: '0' };
  });

  it('sends the form as it is filled in, kept to the ships and the universe', async () => {
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith('send', {
      ships: { fighter: 4, probe: 2 },
      to: { g: 2, s: 30, p: 4, kind: 'moon' },
      mission: 'attack',
      // The holding time chosen (#55); no stay for a mission that does not stay.
      hold: 4,
      stay: 1,
      pct: 5,
      cargo: { m: 10, c: 0, d: 3 },
    });
  });

  it('sends the stay typed for an expedition (#93) and no holding time', async () => {
    client.view = {
      ...client.view!,
      R: { research: { expo: 4 }, rq: null },
    } as unknown as V;
    Object.assign(fleetForm, {
      to: { g: '2', s: '30', p: '16' },
      kind: 'planet',
      mission: 'expedition',
      stay: '3',
    });
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ mission: 'expedition', hold: 0, stay: 3 }),
    );
  });

  it('adds the attack union chosen in the form to the order, and forgets the choice once sent (#225)', async () => {
    client.game!.unions = [
      {
        id: 'f9',
        leader: 'u2',
        to: 'p1_2_6',
        toC: { g: 1, s: 2, p: 6 },
        arr: 5000,
        fleets: [{ id: 'f9', owner: 'u2' }],
        invited: ['u1'],
      },
    ];
    fleetForm.union = 'f9';
    client.ui.union = 'f9';
    const ctx = fakeCtx();
    await acts(ctx).send!({});
    expect(ctx.actHere).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ union: 'f9', mission: 'attack' }),
    );
    expect(client.ui.union).toBeNull();
  });

  it('sends no union that is not among those the player can join, or none chosen', async () => {
    const ctx = fakeCtx();
    for (const union of ['gone', '']) {
      fleetForm.union = union;
      await acts(ctx).send!({});
    }
    for (const call of vi.mocked(ctx.actHere).mock.calls)
      expect(call[1]).not.toHaveProperty('union');
    expect(ctx.actHere).toHaveBeenCalledTimes(2);
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
