// Noob protection, used by the server and the galaxy view: a player with less
// than a fifth of your points can be neither attacked nor spied on by you.

/** A player with fewer points than this share of yours is protected from you (#288). */
export const PROTECTION_RATIO = 5;

export const isProtected = (myPoints: number, theirPoints: number): boolean =>
  theirPoints * PROTECTION_RATIO < myPoints;

/**
 * The fewest points a player may have and not be protected from a player
 * with `mine` points: those with fewer are protected (#288).
 */
export function unprotectedFrom(mine: number): number {
  // Start near the answer and settle on the exact boundary of `isProtected`.
  let theirs = Math.max(0, Math.ceil(mine / PROTECTION_RATIO) - 1);
  while (isProtected(mine, theirs)) theirs++;
  while (theirs > 0 && !isProtected(mine, theirs - 1)) theirs--;
  return theirs;
}
