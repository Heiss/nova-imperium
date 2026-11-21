// Moons in the interface (#53): the symbol on the Sternenkarte, the planet
// list, the target of the fleet form and the lines of the battle report.
import { describe, expect, it } from 'vitest';
import {
  byPlace,
  MOON_FORMED,
  moonAt,
  moonLines,
  moonMarkId,
  moonTarget,
  ownPlaces,
} from './moon.ts';
import type { GalaxyPlanet } from './types.ts';

const place = (
  kind: GalaxyPlanet['kind'],
  p: number,
  owner = 'u_Anna',
  over: Partial<GalaxyPlanet> = {},
): GalaxyPlanet => ({
  id: `${kind === 'moon' ? 'm' : 'p'}1_2_${p}`,
  kind,
  name: kind === 'moon' ? 'Mond' : `Welt ${p}`,
  g: 1,
  s: 2,
  p,
  temp: 20,
  owner,
  ...over,
});

describe('moons in the interface (#53)', () => {
  it('finds the moon of a position, not its planet', () => {
    const galaxy = [place('planet', 5), place('moon', 5), place('planet', 6)];
    expect(moonAt(galaxy, { g: 1, s: 2, p: 5 })).toBe(galaxy[1]);
    expect(moonAt(galaxy, { g: 1, s: 2, p: 6 })).toBeUndefined();
    expect(moonAt(galaxy, { g: 2, s: 2, p: 5 })).toBeUndefined();
    expect(moonAt([], { g: 1, s: 2, p: 5 })).toBeUndefined();
  });

  // The picture and the symbol of a moon are components since #337: their
  // markup is tested in src/test/html-pieces-reference.test.ts
  // (MoonPicture) and src/client/views/galaxy.test.ts (the symbol).
  it('gives the symbol an id that stays the same after a new render, so the focus stays on it', () => {
    expect(moonMarkId('m1_2_5')).toBe('moon-m1_2_5');
  });

  it('lists the own planets and moons, each moon after its planet', () => {
    const galaxy = [
      place('moon', 7),
      place('planet', 5, 'u_Bert'),
      place('planet', 7),
      { ...place('planet', 3), s: 1, id: 'p1_1_3' },
      place('moon', 3, 'u_Anna', { g: 2, id: 'm2_2_3' }),
      place('planet', 3, 'u_Anna', { g: 2, id: 'p2_2_3' }),
      place('planet', 6),
    ];
    expect(ownPlaces(galaxy, 'u_Anna').map((x) => x.id)).toEqual([
      'p1_1_3',
      'p1_2_6',
      'p1_2_7',
      'm1_2_7',
      'p2_2_3',
      'm2_2_3',
    ]);
    expect(ownPlaces(galaxy, 'u_Bert').map((x) => x.id)).toEqual(['p1_2_5']);
    // A planet before its moon, in either order of the list.
    for (const list of [
      [place('planet', 4), place('moon', 4)],
      [place('moon', 4), place('planet', 4)],
      [
        place('moon', 4),
        place('planet', 4),
        place('moon', 3),
        place('planet', 3),
      ],
    ])
      expect(
        ownPlaces(list, 'u_Anna')
          .map((x) => x.id)
          .slice(-2),
      ).toEqual(['p1_2_4', 'm1_2_4']);
    // A long list, as an account with many places has: every moon still
    // follows its planet, whatever order the engine compares them in.
    const many = Array.from({ length: 15 }, (_, i) => [
      place('moon', 15 - i),
      place('planet', 15 - i),
    ]).flat();
    expect(ownPlaces(many, 'u_Anna').map((x) => x.id)).toEqual(
      Array.from({ length: 15 }, (_, i) => [
        `p1_2_${i + 1}`,
        `m1_2_${i + 1}`,
      ]).flat(),
    );
    // Planets in the same system by position.
    expect(
      ownPlaces([place('planet', 9), place('planet', 2)], 'u_Anna').map(
        (x) => x.p,
      ),
    ).toEqual([2, 9]);
  });

  it('orders a moon after its planet, whichever of the two is compared first', () => {
    const planet = place('planet', 4);
    const moon = place('moon', 4);
    expect(byPlace(moon, planet)).toBe(1);
    expect(byPlace(planet, moon)).toBe(-1);
    expect(byPlace(planet, place('planet', 4))).toBe(0);
    expect(byPlace(moon, place('moon', 4))).toBe(0);
    expect(byPlace(place('moon', 3), planet)).toBeLessThan(0);
  });

  it('names a moon target with its owner, or that there is none', () => {
    const moon = place('moon', 5, 'u_Bert', { name: 'L<u>na' });
    expect(moonTarget(moon, (id) => `${id}!`)).toBe(
      'L&lt;u&gt;na (Mond) (u_Bert!)',
    );
    expect(moonTarget(undefined, () => 'x')).toBe(
      '<span class="bad">kein Mond</span>',
    );
  });

  it('shows the moon chance only when it was rolled, and the sentence when a moon formed', () => {
    expect(moonLines({})).toEqual([]);
    expect(moonLines({ moonChance: 0, moon: false })).toEqual([]);
    expect(moonLines({ moonChance: '5', moon: true })).toEqual([]);
    expect(moonLines({ moonChance: 7, moon: false })).toEqual([
      'Mondchance: 7 %',
    ]);
    expect(moonLines({ moonChance: 7 })).toEqual(['Mondchance: 7 %']);
    expect(moonLines({ moonChance: 20, moon: 'yes' })).toEqual([
      'Mondchance: 20 %',
    ]);
    expect(moonLines({ moonChance: 20, moon: true })).toEqual([
      'Mondchance: 20 %',
      'Die enormen Mengen an freiem Adamant und Psikristall ziehen sich an und formen einen Trabanten um den Planeten.',
    ]);
    expect(MOON_FORMED).toMatch(/Trabanten um den Planeten\.$/);
  });
});
