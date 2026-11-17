// The missions the fleet form offers for a target (#253): by the target
// kind of each mission's rules, in the order of the form.
import { describe, expect, it } from 'vitest';
import { missionsFor, type TargetSite } from './mission-choice.ts';
import { MISSION, missionRules, type TargetKind } from './missions.ts';

const own = { owner: 'a' };
const foreign = { owner: 'b' };

/** The missions of these target kinds, in the order of the form. */
const ofKinds = (...kinds: TargetKind[]): string[] =>
  Object.keys(MISSION).filter((m) => kinds.includes(missionRules(m)!.target));

const site = (over: Partial<TargetSite> = {}): TargetSite => ({
  planet: null,
  debris: false,
  ...over,
});

describe('missionsFor', () => {
  it('offers the missions for a foreign or any planet on a foreign planet', () => {
    const list = missionsFor('a', site({ planet: foreign }));
    expect(list).toEqual(ofKinds('foreign', 'any'));
  });

  it('offers the missions for an own or any planet on an own planet', () => {
    const list = missionsFor('a', site({ planet: own }));
    expect(list).toEqual(ofKinds('own', 'any'));
  });

  it('offers only the missions for a free position on an empty field', () => {
    expect(missionsFor('a', site())).toEqual(ofKinds('free'));
  });

  it('adds the Bergung where a Trümmerfeld lies, whatever planet is there (#45)', () => {
    expect(missionsFor('a', site({ debris: true }))).toEqual(
      ofKinds('free', 'debris'),
    );
    expect(missionsFor('a', site({ planet: foreign, debris: true }))).toEqual(
      ofKinds('foreign', 'any', 'debris'),
    );
    expect(missionsFor('a', site({ planet: own, debris: true }))).toEqual(
      ofKinds('own', 'any', 'debris'),
    );
  });

  it('offers no free position and no Trümmerfeld on a moon (#53)', () => {
    expect(
      missionsFor('a', site({ planet: foreign, debris: true, moon: true })),
    ).toEqual(ofKinds('foreign', 'any'));
    expect(
      missionsFor('a', site({ planet: own, debris: true, moon: true })),
    ).toEqual(ofKinds('own', 'any'));
    expect(missionsFor('a', site({ debris: true, moon: true }))).toEqual([]);
    // Not to the moon: the same site offers both again.
    expect(missionsFor('a', site({ debris: true, moon: false }))).toEqual(
      ofKinds('free', 'debris'),
    );
  });

  it('decides own and foreign by the owner of the fleet', () => {
    expect(missionsFor('b', site({ planet: foreign }))).toEqual(
      ofKinds('own', 'any'),
    );
  });
});
