// Places (O11, #119): coordinates plus a kind. The id of a place is derived
// from it, with the kind as prefix: p1_2_3 (planet), m1_2_3 (moon),
// d1_2_3 (debris field). Planet ids of before #119 already start with `p`.
import type { Place } from './types.ts';

const PREFIX = { planet: 'p', moon: 'm', debris: 'd' } as const;

const KIND = { p: 'planet', m: 'moon', d: 'debris' } as const;

export const placeId = (x: Place): string =>
  `${PREFIX[x.kind]}${x.g}_${x.s}_${x.p}`;

// Unanchored: the id must also equal the id of the place it gives (below),
// which refuses anything before or after a canonical id.
const CANONICAL = /([pmd])([1-9]\d*)_([1-9]\d*)_([1-9]\d*)/;

/**
 * The place of an id, or null for anything that is not a canonical id
 * (positive integers without leading zeros), so that
 * `placeId(parsePlaceId(x)) === x`. Never throws on untrusted input.
 */
export function parsePlaceId(id: string): Place | null {
  const m = CANONICAL.exec(id);
  if (!m) return null;
  const place: Place = {
    kind: KIND[m[1] as keyof typeof KIND],
    g: Number(m[2]),
    s: Number(m[3]),
    p: Number(m[4]),
  };
  // Digits beyond the safe integers or text around the id would not give
  // the same id back.
  return placeId(place) === id ? place : null;
}
