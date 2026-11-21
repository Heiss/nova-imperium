// The missions that fit a target (#253; owner, 2026-11-16 and 2026-11-17):
// hidden, not disabled; a Trümmerfeld adds the Bergung; the start planet as
// the target offers none; the browser asks the same check as the server.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canOffer, type FitTarget, missionsFor } from './mission-fit.ts';
import {
  FLEET_MISSIONS,
  fitError,
  missionRules,
  type SendFleet,
  type SendTarget,
  sendError,
} from './missions.ts';
import type { Mission } from './types.ts';

/** Anna flies from her planet 1:1:5. */
const FROM = { owner: 'anna', from: 'p1_1_5' };
const target = (over: Partial<FitTarget> = {}): FitTarget => ({
  planet: null,
  debris: false,
  ...over,
});
const planetOf = (owner: string, id = 'p1_2_6') => ({ id, owner });

describe('the missions that fit a target', () => {
  it('are the transport, the Halten and the attack-like missions on a foreign planet, in the order of the form', () => {
    expect(missionsFor(FROM, target({ planet: planetOf('bert') }))).toEqual([
      'attack',
      'transport',
      'spy',
      'hold',
    ]);
  });

  it('never offers a Landnahme on another player`s planet, nor an attack on an empty field', () => {
    const foreign = missionsFor(FROM, target({ planet: planetOf('bert') }));
    expect(foreign).not.toContain('colonize');
    expect(foreign).not.toContain('survey');
    const free = missionsFor(FROM, target());
    expect(free).not.toContain('attack');
    expect(free).not.toContain('spy');
  });

  it('are the Landnahme and the Vermessung on a free position, and nothing else (no transport)', () => {
    expect(missionsFor(FROM, target())).toEqual(['colonize', 'survey']);
  });

  it('are the transport and the deploy on an own planet', () => {
    expect(
      missionsFor(FROM, target({ planet: planetOf('anna', 'p1_3_7') })),
    ).toEqual(['transport', 'deploy']);
  });

  it('are the transport, the Bergung and the attack-like missions of a foreign planet where a Trümmerfeld lies: the Bergung in addition', () => {
    const at = target({ planet: planetOf('bert'), debris: true });
    expect(missionsFor(FROM, at)).toEqual([
      'attack',
      'transport',
      'spy',
      'harvest',
      'hold',
    ]);
    // On a free position with a field: the missions of the position, and the Bergung.
    expect(missionsFor(FROM, target({ debris: true }))).toEqual([
      'colonize',
      'harvest',
      'survey',
    ]);
    // On an own planet with a field too.
    expect(
      missionsFor(
        FROM,
        target({ planet: planetOf('anna', 'p1_3_7'), debris: true }),
      ),
    ).toEqual(['transport', 'deploy', 'harvest']);
  });

  it('are the Mondbruch and the missions of a planet on a foreign moon, and none of the free kinds', () => {
    const moon = target({ planet: planetOf('bert', 'm1_2_6'), moon: true });
    expect(missionsFor(FROM, moon)).toEqual([
      'attack',
      'transport',
      'spy',
      'hold',
      'moonbreak',
    ]);
    // A moon that is not there: nothing.
    expect(missionsFor(FROM, target({ moon: true }))).toEqual([]);
    // An own moon: transport and deploy.
    expect(
      missionsFor(
        FROM,
        target({ planet: planetOf('anna', 'm1_3_7'), moon: true }),
      ),
    ).toEqual(['transport', 'deploy']);
  });

  it('is the expedition alone on the expedition position', () => {
    expect(missionsFor(FROM, target({ expedition: true }))).toEqual([
      'expedition',
    ]);
  });

  it('keeps a locked free position out of the free kinds, with the server`s check', () => {
    expect(missionsFor(FROM, target({ locked: true }))).toEqual([]);
    // The lock does not touch a Trümmerfeld there.
    expect(missionsFor(FROM, target({ locked: true, debris: true }))).toEqual([
      'harvest',
    ]);
  });

  it('offers no mission at all while the target is the start planet itself, a Trümmerfeld there or not', () => {
    const itself = planetOf('anna', 'p1_1_5');
    expect(missionsFor(FROM, target({ planet: itself }))).toEqual([]);
    expect(missionsFor(FROM, target({ planet: itself, debris: true }))).toEqual(
      [],
    );
    // Another place with the same coordinates is not the start planet: its moon.
    expect(
      missionsFor(
        FROM,
        target({ planet: planetOf('anna', 'm1_1_5'), moon: true }),
      ),
    ).toEqual(['transport', 'deploy']);
    // From a moon, the planet at the same position is a target.
    expect(
      missionsFor(
        { owner: 'anna', from: 'm1_1_5' },
        target({ planet: planetOf('anna', 'p1_1_5') }),
      ),
    ).toEqual(['transport', 'deploy']);
    expect(
      missionsFor(
        { owner: 'anna', from: 'm1_1_5' },
        target({ planet: planetOf('anna', 'm1_1_5'), moon: true }),
      ),
    ).toEqual([]);
  });

  it('leaves what the browser cannot know offered: the protection and the vacation of the owner', () => {
    // The check is run with nothing protected, so these missions stay in the list.
    expect(missionsFor(FROM, target({ planet: planetOf('newbie') }))).toContain(
      'attack',
    );
  });

  it('lists only missions that start from the fleet form, never the missiles', () => {
    for (const at of [
      target(),
      target({ planet: planetOf('bert') }),
      target({ debris: true }),
    ])
      expect(missionsFor(FROM, at)).not.toContain('missile');
    expect(FLEET_MISSIONS).not.toContain('missile');
  });
});

describe('the check of the target', () => {
  it('is the first part of the send check: it asks nothing of the ships', () => {
    const rules = missionRules('colonize')!;
    const at: SendTarget = {
      ...target(),
      protects: () => false,
      vacation: () => false,
    };
    const noArk: SendFleet = { ...FROM, ships: { sc: 1 } };
    expect(fitError(rules, noArk, at)).toBeUndefined();
    expect(sendError(rules, noArk, at)).toBe('noColonyShip');
    expect(fitError(rules, noArk, { ...at, planet: planetOf('bert') })).toBe(
      'occupied',
    );
    expect(sendError(rules, noArk, { ...at, planet: planetOf('bert') })).toBe(
      'occupied',
    );
  });
});

describe('the list and the server', () => {
  /** A fleet that passes the own check of the mission, for the property. */
  const fleetFor = (m: Mission): SendFleet => ({
    ...FROM,
    ships:
      m === 'spy' || m === 'survey'
        ? { probe: 1 }
        : { colony: 1, recycler: 1, dstar: 1, sc: 1 },
    research: { spy: 9, carto: 1, expo: 9 },
  });
  const known = (at: FitTarget): SendTarget => ({
    ...at,
    protects: () => false,
    vacation: () => false,
    // Everyone is an ally and nobody holds: the check of a Halten passes.
    ally: () => true,
    holding: () => [],
  });

  it('never hides a mission the server would accept: whatever the server`s check lets pass is offered', () => {
    const owners = fc.constantFrom('anna', 'bert');
    const places = fc.constantFrom('p1_1_5', 'm1_1_5', 'p1_2_6', 'm1_2_6');
    fc.assert(
      fc.property(
        fc.option(fc.record({ id: places, owner: owners }), { nil: null }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (planet, debris, moon, locked, expedition) => {
          const at: FitTarget = { planet, debris, moon, locked, expedition };
          const offered = missionsFor(FROM, at);
          for (const m of FLEET_MISSIONS) {
            const error = sendError(missionRules(m)!, fleetFor(m), known(at));
            // The start planet as the target is the one thing the browser adds to the check.
            if (error === undefined && planet?.id !== FROM.from)
              expect(offered, m).toContain(m);
          }
          expect(offered).toEqual(
            FLEET_MISSIONS.filter((m) => offered.includes(m)),
          );
        },
      ),
      { seed: 253, numRuns: 400 },
    );
  });

  it('offers a mission only where the target kind of its rules fits: offered implies the server asks no more than the mission itself', () => {
    const at = target({ planet: planetOf('bert') });
    for (const m of missionsFor(FROM, at)) {
      const error = sendError(missionRules(m)!, fleetFor(m), known(at));
      expect(error, m).toBeUndefined();
    }
  });
});

describe('a button for a mission at a target (#95)', () => {
  const ships = (n: number): SendFleet => ({ ...FROM, ships: { dstar: n } });
  const moon = (over: Partial<FitTarget> = {}): FitTarget =>
    target({ planet: planetOf('bert', 'm1_2_6'), moon: true, ...over });

  it('offers the Mondbruch at a foreign moon', () => {
    expect(canOffer('moonbreak', ships(1), moon())).toBe(true);
  });

  it('offers it without a Weltenbrecher too: the ships are not asked (owner, 2026-11-21)', () => {
    expect(canOffer('moonbreak', ships(0), moon())).toBe(true);
    expect(canOffer('moonbreak', FROM, moon())).toBe(true);
  });

  it('offers it not at a planet, an own moon, the start place, or nothing', () => {
    expect(
      canOffer('moonbreak', ships(1), target({ planet: planetOf('bert') })),
    ).toBe(false);
    expect(
      canOffer(
        'moonbreak',
        ships(1),
        moon({ planet: planetOf('anna', 'm1_2_6') }),
      ),
    ).toBe(false);
    expect(
      canOffer(
        'moonbreak',
        ships(1),
        moon({ planet: planetOf('bert', FROM.from) }),
      ),
    ).toBe(false);
    expect(canOffer('moonbreak', ships(1), moon({ planet: null }))).toBe(false);
  });
});
