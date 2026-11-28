// What the fleet view shows (#118, bundle 3): the fleets on their way with
// the slots, the box of the attack unions, the ships that can fly, the form
// and the box of the Warp-Tor, as data.
import { describe, expect, it } from 'vitest';
import { planet, roundDefaults, U } from '../../test/fixtures.ts';
import type { RoundRules } from '../../core/round.ts';
import type { Levels } from '../../core/types.ts';
import type { Ui, V } from '../views/common.ts';
import { CARGO_FIELDS, fleetPage, SPEEDS } from './fleet.ts';
import { fleetForm } from './fleet-form.svelte.ts';
import type { ClientFleet, GalaxyPlanet, GameState } from './types.ts';

const place = (
  kind: GalaxyPlanet['kind'],
  p: number,
  owner: string,
): GalaxyPlanet => ({
  id: `${kind === 'moon' ? 'm' : 'p'}1_2_${p}`,
  kind,
  name: 'Welt',
  g: 1,
  s: 2,
  p,
  temp: 20,
  owner,
});

const fleetOf = (over: Partial<ClientFleet>): ClientFleet =>
  ({
    id: 'f1',
    owner: 'u1',
    mission: 'transport',
    state: 'out',
    fromC: { g: 1, s: 2, p: 5 },
    toC: { g: 1, s: 2, p: 6 },
    to: 'p1_2_6',
    arr: 2000,
    ships: { lc: 1 },
    ...over,
  }) as ClientFleet;

interface Setup {
  ships?: Levels;
  research?: Levels;
  fleets?: ClientFleet[];
  galaxy?: GalaxyPlanet[];
  state?: Partial<GameState>;
  on?: Partial<ReturnType<typeof planet>>;
  ft?: Ui['ft'];
  fm?: string;
  union?: string | null;
}

function view(x: Setup = {}): V {
  const s = {
    cfg: U,
    me: { id: 'u1', research: x.research ?? {} },
    round: { number: 1, ...roundDefaults() } as RoundRules,
    players: { u1: { name: 'Anna' }, u2: { name: 'Bert' } },
    fleets: x.fleets ?? [],
    galaxy: x.galaxy ?? [place('planet', 6, 'u2')],
    debris: [],
    ...x.state,
  } as unknown as GameState;
  return {
    s,
    P: planet({
      id: 'p1_2_5',
      g: 1,
      s: 2,
      p: 5,
      ships: x.ships ?? {},
      ...x.on,
    }),
    R: { research: x.research ?? {}, rq: null },
    now: 1000,
    ui: {
      ft: x.ft ?? null,
      fm: x.fm ?? 'attack',
      union: x.union ?? null,
    } as unknown as Ui,
  };
}

describe('the fleets on their way', () => {
  it('counts the own fleets against the slots, not the gift and not missiles', () => {
    const fleets = [
      fleetOf({ id: 'a' }),
      fleetOf({ id: 'b', gift: true }),
      fleetOf({ id: 'c', mission: 'missile' }),
      fleetOf({ id: 'd', owner: 'u2' }),
    ];
    const page = fleetPage(view({ fleets }));
    expect(page.heading).toBe('Flotten unterwegs (1 / 1 Slots)');
    expect(page.form.full).toBe(true);
  });

  it('lists the fleets as the overview does, the own ones only', () => {
    const fleets = [fleetOf({ id: 'a' }), fleetOf({ id: 'd', owner: 'u2' })];
    expect(fleetPage(view({ fleets })).fleets.map((f) => f.id)).toEqual(['a']);
  });

  it('counts the expeditions against their slots once the research is there (#93)', () => {
    const fleets = [fleetOf({ mission: 'expedition' }), fleetOf({ id: 'g' })];
    expect(fleetPage(view({ fleets })).heading).not.toContain('Expeditionen');
    const page = fleetPage(view({ fleets, research: { expo: 4 } }));
    expect(page.heading).toBe(
      'Flotten unterwegs (2 / 1 Slots) · Expeditionen (1 / 2)',
    );
  });
});

describe('the ships and the form', () => {
  it('lists the ships that fly, with the numbers as the view writes them', () => {
    const page = fleetPage(view({ ships: { lc: 1500, sat: 4, probe: 1 } }));
    expect(page.ships.map((s) => [s.key, s.have])).toEqual([
      ['lc', '1.500'],
      ['probe', '1'],
    ]);
    expect(fleetPage(view({ ships: { sat: 4 } })).ships).toEqual([]);
  });

  it('starts the target on the shown planet and offers the moon only where one is', () => {
    const page = fleetPage(view({ ships: { lc: 1 } }));
    expect(page.form.target).toMatchObject({
      g: 1,
      s: 2,
      p: 5,
      galaxies: U.galaxies,
      systems: U.systems,
      positions: U.positions + 1,
    });
    // What the fields show for a form nobody touched (logic/fleet-choice.ts).
    expect(page.form.choose(fleetForm)).toMatchObject({
      to: { g: 1, s: 2, p: 5 },
      moon: false,
      kind: 'planet',
    });
    const moon = fleetPage(
      view({
        ships: { lc: 1 },
        galaxy: [place('planet', 6, 'u2'), place('moon', 6, 'u2')],
        ft: { g: 1, s: 2, p: 6, kind: 'moon' },
      }),
    );
    expect(moon.form.target).toMatchObject({ p: 6 });
    expect(moon.form.choose(fleetForm)).toMatchObject({
      moon: true,
      kind: 'moon',
    });
  });

  it('keeps the chosen mission while it fits the target, else the first that does', () => {
    const at = { ft: { g: 1, s: 2, p: 6 }, ships: { lc: 1 } };
    const mission = (fm: string) =>
      fleetPage(view({ ...at, fm })).form.choose(fleetForm).mission;
    expect(mission('spy')).toBe('spy');
    expect(mission('colonize')).toBe('attack');
  });

  it('lists the missions that fit the target and selects the one chosen', () => {
    const form = fleetPage(
      view({ ships: { lc: 1 }, ft: { g: 1, s: 2, p: 6 }, fm: 'spy' }),
    ).form;
    const { missions } = form.choose(fleetForm);
    expect(missions.find((m) => m.selected)).toMatchObject({ value: 'spy' });
    // The row of the time is the holding time, hidden, for a mission that does not hold.
    expect(form.choose(fleetForm)).toMatchObject({
      stays: false,
      holds: false,
    });
  });

  it('offers the speeds from 100 to 10 % and the three cargo fields', () => {
    expect(SPEEDS.map((s) => s.label).slice(0, 2)).toEqual(['100 %', '90 %']);
    expect(SPEEDS).toHaveLength(10);
    expect(CARGO_FIELDS.map((c) => c.key)).toEqual(['m', 'c', 'd']);
  });

  it('chooses the union the form joins among the unions it can join', () => {
    const unions = [
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
    const none = fleetPage(view({ ships: { lc: 1 } })).form.unions;
    expect(none).toEqual([]);
    const page = fleetPage(
      view({ ships: { lc: 1 }, state: { unions }, union: 'f9' }),
    );
    expect(page.form.unions.map((u) => u.value)).toEqual(['f9']);
    // While the switch of the round is off, no union to join (#466).
    const off = view({ ships: { lc: 1 }, state: { unions }, union: 'f9' });
    off.s.round = { ...off.s.round, unionOn: 0 };
    expect(fleetPage(off).form.unions).toEqual([]);
    expect(fleetPage(off).form.plans).toBe(false);
    expect(page.form.plans).toBe(true);
    // The one of the page, else the one chosen; none that is gone.
    expect(page.form.choose(fleetForm).union).toBe('f9');
    fleetForm.union = '';
    expect(page.form.choose(fleetForm).union).toBe('');
    fleetForm.union = 'zz';
    expect(page.form.choose(fleetForm).union).toBe('');
    fleetForm.union = null;
    expect(page.unions?.unions.map((u) => u.id)).toEqual(['f9']);
  });
});

describe('the box of the unions', () => {
  it('is there only for a union of the player: an own Sturmangriff opens none any more (#466)', () => {
    expect(fleetPage(view()).unions).toBeNull();
    const attack = fleetOf({ mission: 'attack', arr: 5000 });
    expect(fleetPage(view({ fleets: [attack] })).unions).toBeNull();
  });
});

describe('the box of the Warp-Tor', () => {
  it('is only there on a moon with a gate', () => {
    expect(fleetPage(view()).jump).toBeNull();
  });

  it('lists the other own moons with a gate and counts a cooling gate down', () => {
    const galaxy = [place('moon', 5, 'u1'), place('moon', 8, 'u1')];
    const page = fleetPage(
      view({
        galaxy,
        on: { id: 'm1_2_5', kind: 'moon', b: { jumpgate: 1 } },
        state: {
          gates: [
            { id: 'm1_2_5', level: 1, ready: 3000 },
            { id: 'm1_2_8', level: 1, ready: 0 },
          ],
        },
      }),
    );
    expect(page.jump?.targets.map((t) => t.value)).toEqual(['m1_2_8']);
    expect(page.jump?.canJump).toBe(false);
    expect(page.jump?.cooling).toMatchObject({ end: 3000 });
  });
});
