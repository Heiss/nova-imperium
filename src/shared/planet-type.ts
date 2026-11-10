// The look of a planet (issue #52, decisions D1.1 look only, D2.1 slot and
// system parity). It follows from the coordinates alone, so every planet,
// old or new, has its type without stored data.
import type { Coords } from './types.ts';

export type PlanetType =
  'wueste' | 'trocken' | 'normal' | 'dschungel' | 'wasser' | 'eis' | 'gas';

export const PLANET_TYPE_NAMES: Record<PlanetType, string> = {
  wueste: 'Wüstenplanet',
  trocken: 'Trockener Planet',
  normal: 'Normaler Planet',
  dschungel: 'Dschungelplanet',
  wasser: 'Wasserplanet',
  eis: 'Eisplanet',
  gas: 'Gasriese',
};

/** Rows of two slots each, from slot 1 on: [odd system, even system]. */
const ROWS: readonly (readonly [PlanetType, PlanetType])[] = [
  ['trocken', 'wueste'],
  ['normal', 'trocken'],
  ['dschungel', 'normal'],
  ['wasser', 'dschungel'],
  ['eis', 'wasser'],
  ['gas', 'eis'],
  ['normal', 'gas'],
];

/** Slots 1 to 3 share the first row, then every row has two slots. */
const row = (p: number): number => (p <= 3 ? 0 : Math.floor((p - 2) / 2));

/** Slots beyond the table (16 to 20) are gas giants (owner decision). */
export function planetType(c: Pick<Coords, 's' | 'p'>): PlanetType {
  const r = ROWS[row(c.p)];
  if (!r) return 'gas';
  return r[c.s % 2 === 0 ? 1 : 0];
}

/** Fixed variants per type (owner decision: 3). */
export const PLANET_VARIANTS = 3;

/** Neighbours in a system get different variants. */
export const planetVariant = (c: Coords): number =>
  (c.g + c.s + c.p - 3) % PLANET_VARIANTS;
