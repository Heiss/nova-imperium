// What the fleet form shows for its state (#332): the target kept to the
// universe, and the kind of target, a moon only where one is.
import { afterEach, describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui } from '../views/common.ts';
import { fleetChoice, type FleetSeen, fleetTarget } from './fleet-choice.ts';
import { fleetForm } from './fleet-form.svelte.ts';
import { forgetForms } from './form-state.svelte.ts';
import type { GameState } from './types.ts';

afterEach(forgetForms);

const moonAt = (g: number, s: number, p: number) => ({
  id: `m${g}_${s}_${p}`,
  kind: 'moon' as const,
  name: 'Mond',
  g,
  s,
  p,
  temp: 1,
  owner: 'u2',
});

/** The planet stands at 1:1:5; a moon is at 1:2:6. */
function seen(ui: Partial<Ui> = {}): FleetSeen {
  return {
    s: { cfg: U, galaxy: [moonAt(1, 2, 6)] } as unknown as GameState,
    P: planet({ g: 1, s: 1, p: 5 }),
    ui: { ft: null, ...ui } as Ui,
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
    expect(fleetChoice(v, fleetForm).to).toEqual({ g: 1, s: 2, p: 6 });
    fleetForm.to = { g: null, s: '1', p: '3' };
    expect(fleetChoice(v, fleetForm).to).toEqual({ g: 1, s: 1, p: 3 });
  });

  it('keeps every number to the universe, an empty field to the lowest', () => {
    fleetForm.to = { g: '99', s: '999', p: '' };
    const { to } = fleetChoice(seen(), fleetForm);
    expect(to).toEqual({ g: U.galaxies, s: U.systems, p: 1 });
    fleetForm.to = { g: '1', s: '1', p: '99' };
    expect(fleetChoice(seen(), fleetForm).to.p).toBe(U.positions + 1);
  });
});

describe('the kind of target', () => {
  const atMoon = { ft: { g: 1, s: 2, p: 6 } };

  it('offers the moon only where one is', () => {
    expect(fleetChoice(seen(atMoon), fleetForm).moon).toBe(true);
    expect(fleetChoice(seen(), fleetForm).moon).toBe(false);
  });

  it('is the planet while nobody chose the moon, and the moon the page aims at', () => {
    expect(fleetChoice(seen(atMoon), fleetForm).kind).toBe('planet');
    expect(
      fleetChoice(seen({ ft: { g: 1, s: 2, p: 6, kind: 'moon' } }), fleetForm)
        .kind,
    ).toBe('moon');
  });

  it('is the moon the player chose before, where a moon is', () => {
    const v = seen({ ...atMoon, fk: 'moon' });
    expect(fleetChoice(v, fleetForm).kind).toBe('moon');
    // Not a moon that is not there.
    expect(fleetChoice(seen({ fk: 'moon' }), fleetForm).kind).toBe('planet');
  });

  it('follows the choice of the player before the page', () => {
    fleetForm.kind = 'planet';
    const v = seen({ ft: { g: 1, s: 2, p: 6, kind: 'moon' }, fk: 'moon' });
    expect(fleetChoice(v, fleetForm).kind).toBe('planet');
    fleetForm.kind = 'moon';
    expect(fleetChoice(seen(atMoon), fleetForm).kind).toBe('moon');
    expect(fleetChoice(seen(), fleetForm).kind).toBe('planet');
  });
});
