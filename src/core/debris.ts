// Trümmerfelder (#45, okf/features/debris.md; owner, 2026-11-13): after a
// battle, 30 % of the Adamant and Psikristall of every destroyed ship of
// both sides, Sonnenreliquiare included, lie at the position. No Promethium,
// no defense. A field adds up over several battles and stays until it is
// harvested; an empty field disappears. It is a place of its own (#119, O11)
// with the id `d<g>_<s>_<p>`. This is the debris step of the battle's
// consequences (okf/architecture/patterns.md, section 5): a pure function of
// the losses, without random draws.
import { FIGHTERS } from './catalog.ts';
import { wreck } from './components/unit.ts';
import type { Coords, Levels } from './types.ts';

/** What a Trümmerfeld holds: Adamant and Psikristall, never Promethium. */
export interface Debris {
  m: number;
  c: number;
}

/** A Trümmerfeld at a position, with the id of its place. */
export interface DebrisField extends Coords, Debris {
  id: string;
}

/** The share of the destroyed ships that becomes debris. */
export const DEBRIS_SHARE = 0.3;

/** The units of one side of a battle, before and after it. */
export interface Side {
  before: Levels;
  after: Levels;
}

/** The ship of a key; defense and unknown keys leave no debris. */
const ship = (key: string) =>
  Object.hasOwn(FIGHTERS, key) && FIGHTERS[key]!.kind === 'ship'
    ? FIGHTERS[key]
    : undefined;

/** The debris of a battle: the share of every ship lost by any side. */
export function debrisOf(sides: readonly Side[]): Debris {
  let m = 0;
  let c = 0;
  for (const { before, after } of sides)
    for (const [key, n] of Object.entries(before)) {
      const f = ship(key);
      const lost = n - (after[key] ?? 0);
      if (!f || lost <= 0) continue;
      const w = wreck(f.unit, lost);
      m += w.m;
      c += w.c;
    }
  return { m: m * DEBRIS_SHARE, c: c * DEBRIS_SHARE };
}

/** Whether a field holds nothing any more: then it disappears. */
export const isEmpty = (d: Debris): boolean => d.m <= 0 && d.c <= 0;
