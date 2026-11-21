// The expedition's find of ships and its expedition points (#93,
// okf/features/expeditions.md): the part of src/core/expedition.ts that reads
// the catalog, apart from it because the rules of the mission folder import
// the rest and the catalog reads the mission folders.
import type { Rng } from './battle.ts';
import { SHIPS } from './catalog.ts';
import { type Size, between, capsOf, evenBetween } from './expedition.ts';
import type { Levels } from './types.ts';

/** Expedition points of a fleet: its structure points · 5 / 1000, ships only. */
export function expoPoints(ships: Levels): number {
  let points = 0;
  for (const [key, n] of Object.entries(ships)) {
    const unit = Object.hasOwn(SHIPS, key) ? SHIPS[key] : undefined;
    if (unit && n > 0) points += (n * (unit.cost[0] + unit.cost[1]) * 5) / 1000;
  }
  return points;
}

/**
 * The ships that can be found, from the lightest to the heaviest; a ship
 * finds its own kind and everything up to one step heavier (owiki
 * „Auffindbare Schiffe“). The Kolonistenarche, the Bergungsbarke and the
 * Weltenbrecher are not on it: they find nothing and are never found.
 */
const TIERS: Readonly<Record<string, number>> = {
  probe: 1,
  sc: 2,
  lf: 3,
  lc: 4,
  hf: 5,
  cr: 6,
  bs: 7,
  bc: 8,
  bb: 9,
  dr: 10,
};

/** The findable ships of a fleet, by their keys, the lightest first. */
export function findable(fleet: Levels): string[] {
  let top = 0;
  for (const [key, n] of Object.entries(fleet))
    if (n > 0 && Object.hasOwn(TIERS, key))
      top = Math.max(top, TIERS[key]! + 1);
  return Object.keys(TIERS).filter((key) => TIERS[key]! <= top);
}

/** The structure points of one ship: Adamant plus Psikristall of its cost. */
const structure = (key: string): number =>
  SHIPS[key]!.cost[0] + SHIPS[key]!.cost[1];

/** The most structure points of a find of ships: at least 10,000 (owiki „Größe von Flottenfunden“). */
export const MIN_SHIP_FIND = 10_000;

/** The base number of a find of ships: any number 10 to 50, an even one 52 to 100 or 102 to 200. */
export const shipBase = (rng: Rng, size: Size): number => {
  if (size === 'normal') return between(rng, 10, 50);
  return size === 'large'
    ? evenBetween(rng, 52, 100)
    : evenBetween(rng, 102, 200);
};

/**
 * A find of ships of the drawn size (owiki „Flottenfund“): the base number
 * times the expedition points (at most the cap of the rank-1 player) are the
 * structure points of the find, at least 10,000. Then a findable ship is
 * drawn, all equally likely, and found between 1 and as many times as the
 * structure points left allow, until they are used up or the drawn ship is
 * heavier than what is left. [V] The article leaves open how often it draws
 * again; this stops at the first ship that no longer fits.
 */
export function shipFind(
  rng: Rng,
  size: Size,
  fleet: Levels,
  points: number,
  rank1: number,
): Levels {
  const found: Levels = {};
  const pool = findable(fleet);
  if (!pool.length) return found;
  const base = shipBase(rng, size);
  let left = Math.max(
    MIN_SHIP_FIND,
    base * Math.min(points, capsOf(rank1).ships),
  );
  while (left > 0) {
    const key = pool[Math.floor(rng() * pool.length)]!;
    const most = Math.floor(left / structure(key));
    if (most < 1) break;
    const n = between(rng, 1, most);
    found[key] = (found[key] ?? 0) + n;
    left -= n * structure(key);
  }
  return found;
}
