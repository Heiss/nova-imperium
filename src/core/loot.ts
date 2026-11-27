// The loot of a won battle and the rebuilt defense, the rules the Sturmangriff
// and the Mondbruch share (okf/architecture/patterns.md, section 5). They live
// here, in the core, so that the server and the Lexicanum read the same
// numbers (#288, the direction of #214): `src/server/game/fight.ts` uses them
// and re-exports the functions.
import type { Resources } from './types.ts';

/** The winner takes up to this share of each resource of the planet. */
export const LOOT_SHARE = 0.5;

/** The share of the destroyed defense that is rebuilt. */
export const REBUILD_SHARE = 0.7;

/** Below this many lost pieces of a kind the rebuilding is drawn piece by piece. */
export const REBUILD_DRAWN_BELOW = 50;

/** 70 % of the destroyed defense is rebuilt: by chance below 50 units, else rounded. */
export function rebuild(lost: number, rng: () => number): number {
  if (lost >= REBUILD_DRAWN_BELOW) return Math.round(lost * REBUILD_SHARE);
  let n = 0;
  for (let i = 0; i < lost; i++) if (rng() < REBUILD_SHARE) n++;
  return n;
}

/**
 * Fills `free` cargo space from `avail` in the order of the classic loot:
 * a third Adamant, half of the rest Psikristall, the rest Promethium, then
 * what is left over, Adamant first.
 */
function fill(avail: Resources, free: number): Resources {
  let cap = free;
  const loot = { m: 0, c: 0, d: 0 };
  const take = (k: keyof Resources, limit: number): void => {
    const v = Math.max(0, Math.floor(Math.min(avail[k] - loot[k], limit)));
    loot[k] += v;
    cap -= v;
  };
  take('m', cap / 3);
  take('c', cap / 2);
  take('d', cap);
  take('m', cap / 2);
  take('c', cap);
  take('m', cap);
  return loot;
}

/**
 * The winner takes up to half of each resource (`share`), as much as the
 * holds carry. The cargo of the fleets that held at the planet is no loot
 * since #440 (233b).
 */
export const plunder = (
  stock: Resources,
  free: number,
  share = LOOT_SHARE,
): Resources =>
  fill({ m: stock.m * share, c: stock.c * share, d: stock.d * share }, free);

/**
 * Loot cut to the holds that are left (#95; owner, 2026-11-16): what no
 * longer fits is lost, in the order of the loot.
 */
export const cutLoot = (loot: Resources, free: number): Resources =>
  fill(loot, free);
