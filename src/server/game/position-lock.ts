// The lock of a given-up colony's position (#224, D2): no colony and no new
// home planet there until the lock ends. The rule is `positionLocked` of
// src/core/abandon.ts (patterns, section 7).
import { positionLocked } from '../../core/abandon.ts';
import type { Coords } from '../../core/types.ts';
import type { Ctx } from './context.ts';
import { lockEndText } from './main-planet.ts';

/** The end of the lock of a position while it holds at `at`, else null. */
export function lockedUntil(ctx: Ctx, c: Coords, at: number): number | null {
  const end = ctx.planets.positionLock(c);
  return positionLocked(end, at) ? end : null;
}

/** The refusal of a colonization while the position is locked [V]. */
export const positionLockedText = (end: number): string =>
  `Diese Position ist gesperrt. Wieder besiedelbar ab ${lockEndText(end)}.`;
