// What the Lexicanum reads of the player's own state (#288, #289): the shown
// planet, the planets the player owns, the own fleets in flight and the
// points. The browser has all of it already, so the personal hints need no
// request of their own; this stays a small pure function.
import type { Own } from '../../core/lexicon/types.ts';
import { isFleet } from '../../core/missions.ts';
import type { V } from '../views/common.ts';

/** The own state the personal parts of a page are computed from. */
export function ownState(v: V): Own {
  const me = v.s.me.id;
  const points = Object.values(v.s.players).map((p) => p.points ?? 0);
  return {
    planet: v.P,
    // A moon is no planet of the limit; every planet has an owner.
    planets: v.s.galaxy.filter((p) => p.owner === me && p.kind === 'planet')
      .length,
    // A fleet that takes a slot: no gift of the Endzeit, no missiles.
    fleets: v.s.fleets.filter((f) => f.owner === me && isFleet(f)).length,
    points: {
      own: v.s.players[me]?.points ?? 0,
      top: Math.max(0, ...points),
    },
    now: v.now,
  };
}
