// What the fleet form shows for its state (#332): the target kept to the
// universe, the kind of target (a moon only where one is) and the mission
// (only one that fits the target).
import { afterEach, describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import { planet, roundDefaults, U } from '../../test/fixtures.ts';
import type { Ui } from '../views/common.ts';
import { fleetChoice, type FleetSeen, fleetTarget } from './fleet-choice.ts';
import { fleetForm } from './fleet-form.svelte.ts';
import { forgetForms } from './form-state.svelte.ts';
import type { GalaxyPlanet, GameState } from './types.ts';

afterEach(forgetForms);

const placeAt = (
  kind: GalaxyPlanet['kind'],
  s: number,
  p: number,
  owner: string,
): GalaxyPlanet => ({
  id: `${kind === 'moon' ? 'm' : 'p'}1_${s}_${p}`,
  kind,
  name: 'Welt',
  g: 1,
  s,
  p,
  temp: 1,
  owner,
});

const choose = (v: FleetSeen) => fleetChoice(v, fleetForm, 0);

/** The planet stands at 1:1:5; a foreign planet with its moon is at 1:2:6. */
function seen(ui: Partial<Ui> = {}): FleetSeen {
  return {
    s: {
      cfg: U,
      me: { id: 'u1', research: { expo: 4 } },
      round: { number: 1, ...roundDefaults() } as RoundRules,
      players: { u1: { name: 'Anna' }, u2: { name: 'Bert' } },
      fleets: [],
      debris: [],
      galaxy: [
        placeAt('planet', 1, 5, 'u1'),
        placeAt('planet', 2, 6, 'u2'),
        placeAt('moon', 2, 6, 'u2'),
      ],
    } as unknown as GameState,
    P: planet({ id: 'p1_1_5', g: 1, s: 1, p: 5 }),
    R: { research: { expo: 4 }, rq: null },
    ui: { ft: null, fm: 'attack', ...ui } as Ui,
  };
}

describe('the target of the form', () => {
  it('starts on the shown planet, or where the page aims at', () => {
    expect(fleetTarget(seen())).toEqual({ g: 1, s: 1, p: 5 });
    expect(fleetTarget(seen({ ft: { g: 2, s: 3, p: 4 } }))).toEqual({
      g: 2,
      s: 3,
      p: 4,
    });
  });

  it('shows the target of the page for a field nobody typed in, and what was typed for the others', () => {
    const v = seen({ ft: { g: 1, s: 2, p: 6 } });
    expect(choose(v).to).toEqual({ g: 1, s: 2, p: 6 });
    fleetForm.to = { g: null, s: '1', p: '3' };
    expect(choose(v).to).toEqual({ g: 1, s: 1, p: 3 });
  });

  it('keeps every number to the universe, an empty field to the lowest', () => {
    fleetForm.to = { g: '99', s: '999', p: '' };
    const { to } = choose(seen());
    expect(to).toEqual({ g: U.galaxies, s: U.systems, p: 1 });
    fleetForm.to = { g: '1', s: '1', p: '99' };
    expect(choose(seen()).to.p).toBe(U.positions + 1);
  });
});

describe('the kind of target', () => {
  const atMoon = { ft: { g: 1, s: 2, p: 6 } };

  it('offers the moon only where one is', () => {
    expect(choose(seen(atMoon)).moon).toBe(true);
    expect(choose(seen()).moon).toBe(false);
  });

  it('is the planet while nobody chose the moon, and the moon the page aims at', () => {
    expect(choose(seen(atMoon)).kind).toBe('planet');
    expect(choose(seen({ ft: { g: 1, s: 2, p: 6, kind: 'moon' } })).kind).toBe(
      'moon',
    );
  });

  it('is the moon the player chose before, where a moon is', () => {
    const v = seen({ ...atMoon, fk: 'moon' });
    expect(choose(v).kind).toBe('moon');
    // Not a moon that is not there.
    expect(choose(seen({ fk: 'moon' })).kind).toBe('planet');
  });

  it('follows the choice of the player before the page', () => {
    fleetForm.kind = 'planet';
    const v = seen({ ft: { g: 1, s: 2, p: 6, kind: 'moon' }, fk: 'moon' });
    expect(choose(v).kind).toBe('planet');
    fleetForm.kind = 'moon';
    expect(choose(seen(atMoon)).kind).toBe('moon');
    expect(choose(seen()).kind).toBe('planet');
  });
});

describe('the mission', () => {
  const atForeign = { ft: { g: 1, s: 2, p: 6 } };
  const values = (v: FleetSeen) => choose(v).missions.map((o) => o.value);

  it('lists the missions that fit the target and selects the one of the page while it fits', () => {
    const v = seen({ ...atForeign, fm: 'spy' });
    expect(values(v)).toContain('spy');
    expect(values(v)).not.toContain('colonize');
    expect(choose(v).mission).toBe('spy');
    expect(choose(v).missions.filter((o) => o.selected)).toEqual([
      {
        value: 'spy',
        label: expect.any(String),
        selected: true,
        disabled: false,
      },
    ]);
  });

  it('takes the first mission that fits when the one of the page does not', () => {
    const v = seen({ ...atForeign, fm: 'colonize' });
    expect(choose(v).mission).toBe(values(v)[0]);
  });

  it('follows the choice of the player before the page', () => {
    fleetForm.mission = 'transport';
    expect(choose(seen({ ...atForeign, fm: 'spy' })).mission).toBe('transport');
    // An empty choice is none.
    fleetForm.mission = '';
    expect(choose(seen({ ...atForeign, fm: 'spy' })).mission).toBe('spy');
  });

  it('follows the typed target, not the one of the page', () => {
    const v = seen({ ft: { g: 1, s: 1, p: 5 } });
    expect(values(v)).toEqual(['']);
    fleetForm.to = { g: '1', s: '2', p: '6' };
    expect(values(v)).toContain('attack');
  });

  it('says that none fits the start planet, with no mission to send', () => {
    const none = choose(seen());
    expect(none.mission).toBe('');
    expect(none.missions).toEqual([
      {
        value: '',
        label: 'Kein Auftrag passt zum Ziel',
        selected: true,
        disabled: true,
      },
    ]);
    expect(none.limit).toBe('');
  });

  it('names the planets against the limit for a Landnahme', () => {
    fleetForm.mission = 'colonize';
    fleetForm.to = { g: '1', s: '2', p: '8' };
    expect(choose(seen()).limit).toMatch(/^Planeten: /);
    fleetForm.mission = 'spy';
    fleetForm.to = { g: '1', s: '2', p: '6' };
    expect(choose(seen()).limit).toBe('');
  });
});

describe('the time at the target', () => {
  const atExpedition = { ft: { g: 1, s: 2, p: 16 } };
  const atForeign = { ft: { g: 1, s: 2, p: 6 } };

  it('is the holding time of a Halten, 1 hour to start with, and no stay', () => {
    const choice = choose(seen({ ...atForeign, fm: 'hold' }));
    expect(choice).toMatchObject({
      stays: false,
      holds: true,
      hold: '1',
      stayMost: 0,
      real: '',
    });
  });

  it('holds only for a Halten, and the row is hidden for the other missions', () => {
    expect(choose(seen({ ...atForeign, fm: 'attack' })).holds).toBe(false);
    expect(choose(seen()).holds).toBe(false);
  });

  it('is the stay of an expedition, 1 hour to start with, up to the level of the research', () => {
    const choice = choose(seen({ ...atExpedition, fm: 'expedition' }));
    expect(choice).toMatchObject({
      stays: true,
      holds: false,
      stay: '1',
      stayMost: 4,
    });
    // At least one hour, also without the research.
    const bare = seen({ ...atExpedition, fm: 'expedition' });
    bare.R = { research: {}, rq: null };
    expect(choose(bare).stayMost).toBe(1);
  });

  it('follows what was chosen and typed', () => {
    fleetForm.hold = '8';
    fleetForm.stay = '3';
    expect(choose(seen({ ...atForeign, fm: 'hold' })).hold).toBe('8');
    expect(choose(seen({ ...atExpedition, fm: 'expedition' })).stay).toBe('3');
  });

  it('says the real time of the stay only where the universe speed divides it', () => {
    fleetForm.stay = '5';
    const v = seen({ ...atExpedition, fm: 'expedition' });
    expect(choose(v).real).toBe('');
    v.s.cfg = { ...U, speed: 5, roundExpeditionSpeed: 1 };
    expect(choose(v).real).toBe(
      'entspricht 1h 00m 00s (durch Tempo 5 geteilt)',
    );
    fleetForm.stay = '';
    expect(choose(v).real).toBe('');
  });
});
