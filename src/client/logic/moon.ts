// Moons in the interface (#53, owner, 2026-11-13 and 2026-11-14): the
// symbol on the Sternenkarte that opens the moon's actions, the target of
// the fleet form, the planet list and the lines of the battle report.
import { placeName } from '../../core/moon.ts';
import { placeId } from '../../core/place.ts';
import type { Coords } from '../../core/types.ts';
import { esc } from './format.ts';
import type { GalaxyPlanet } from './types.ts';

/** The moon at a position, if one is there. */
export const moonAt = (
  galaxy: readonly GalaxyPlanet[],
  c: Coords,
): GalaxyPlanet | undefined => {
  const id = placeId({ g: c.g, s: c.s, p: c.p, kind: 'moon' });
  return galaxy.find((x) => x.id === id);
};

/** The picture of a moon, also the symbol on the Sternenkarte. */
export const moonPicture = (name: string, size: number): string =>
  `<img class="moon" src="/icons/moon.svg" alt="${esc(name)}" width="${size}" height="${size}">`;

/**
 * The id of the symbol of a moon: stable over a new render, so the focus
 * stays on it after it opened or closed the moon's actions.
 */
export const moonMarkId = (id: string): string => `moon-${id}`;

/** The symbol at the planet: a button that opens or closes the moon's actions. */
export const moonMark = (moon: GalaxyPlanet, open: boolean): string =>
  `<button type="button" id="${esc(moonMarkId(moon.id))}" class="moon-btn" data-act="gmoon" data-id="${esc(moon.id)}" aria-expanded="${open}" title="${esc(placeName(moon))}">${moonPicture(placeName(moon), 20)}</button>`;

/** The own planets and moons for the planet list: each moon after its planet. */
export const ownPlaces = (
  galaxy: readonly GalaxyPlanet[],
  me: string,
): GalaxyPlanet[] =>
  galaxy
    .filter((x) => x.owner === me)
    .sort(
      (a, b) =>
        a.g - b.g ||
        a.s - b.s ||
        a.p - b.p ||
        Number(a.kind === 'moon') - Number(b.kind === 'moon'),
    );

/**
 * What the fleet form shows beside a moon as target: the moon and its
 * owner, or that there is none.
 */
export const moonTarget = (
  moon: GalaxyPlanet | undefined,
  owner: (id: string) => string,
): string =>
  moon
    ? `${esc(placeName(moon))} (${esc(owner(moon.owner))})`
    : '<span class="bad">kein Mond</span>';

/** The sentence when a moon forms (#53, the decided wording). */
export const MOON_FORMED =
  'Die enormen Mengen an freiem Adamant und Psikristall ziehen sich an und formen einen Trabanten um den Planeten.';

/**
 * The moon lines of a battle report: „Mondchance: x %“ only when the chance
 * was rolled, and the sentence when the moon formed (owner, 2026-11-14).
 */
export function moonLines(r: Readonly<Record<string, unknown>>): string[] {
  if (typeof r.moonChance !== 'number' || r.moonChance <= 0) return [];
  const chance = `Mondchance: ${r.moonChance} %`;
  return r.moon === true ? [chance, MOON_FORMED] : [chance];
}
