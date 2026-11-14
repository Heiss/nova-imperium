// Moons in the interface (#53): the symbol on the Sternenkarte, the planet
// list, the target of the fleet form and the lines of the battle report.
import { describe, expect, it } from 'vitest';
import {
  MOON_FORMED,
  moonAt,
  moonLines,
  moonMark,
  moonPicture,
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

  it('draws the moon with its name for screen readers', () => {
    expect(moonPicture('Luna <b> (Mond)', 28)).toBe(
      '<img class="moon" src="/icons/moon.svg" alt="Luna &lt;b&gt; (Mond)" width="28" height="28">',
    );
  });

  it('makes the symbol a button that opens and closes the moon row', () => {
    const moon = place('moon', 5, 'u_Bert', { name: 'Luna' });
    expect(moonMark(moon, false)).toBe(
      '<button type="button" class="moon-btn" data-act="gmoon" data-id="m1_2_5" aria-expanded="false" title="Luna (Mond)"><img class="moon" src="/icons/moon.svg" alt="Luna (Mond)" width="20" height="20"></button>',
    );
    expect(moonMark(moon, true)).toContain('aria-expanded="true"');
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
    // Planets in the same system by position.
    expect(
      ownPlaces([place('planet', 9), place('planet', 2)], 'u_Anna').map(
        (x) => x.p,
      ),
    ).toEqual([2, 9]);
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
