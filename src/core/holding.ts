// Holding („Halten“, #55, okf/features/holding-acs.md): a fleet flies to the
// planet of an ally, stays there for the holding time the player chose at
// the launch and defends it with its owner, then flies home. Who counts as
// an ally is the admin's value per round: guild members, friends or both
// (owner, 2026-11-16, Q2). The server, the fleet form and the overview ask
// these rules (patterns, section 7). The alliance depot comes later (D1).
import type { Fleet, Resources } from './types.ts';

/** One hour in milliseconds; the holding time runs in real time [V]. */
export const HOUR_MS = 3_600_000;

/** The holding times a player can choose, in hours (owner, 2026-11-16, classic). */
export const HOLD_HOURS: readonly number[] = [0, 1, 2, 4, 8, 16, 32];

/** Whether `hours` is a holding time a player can choose. */
export const isHoldHours = (hours: unknown): hours is number =>
  typeof hours === 'number' && HOLD_HOURS.includes(hours);

/**
 * At most four different players and 15 fleets hold at one planet, besides
 * the owner's own fleet (owner, 2026-11-16, classic).
 */
export const HOLD_LIMITS = { players: 4, fleets: 15 } as const;

/**
 * Who may hold at a player, as the admin sets it per round (Q2): bit 1 the
 * members of the own guild, bit 2 the friends (#227); 3 is both, the
 * classic rule and the default [V].
 */
export const ALLIES = { guild: 1, friends: 2, both: 3 } as const;

/** The range of the setting „who may hold“: one of `ALLIES`. */
export const ALLIES_RANGE = {
  min: ALLIES.guild,
  max: ALLIES.both,
  default: ALLIES.both,
} as const;

/** Whether `allies` is a value of the setting „who may hold“. */
export const isAllies = (allies: unknown): allies is number =>
  Number.isInteger(allies) &&
  (allies as number) >= ALLIES_RANGE.min &&
  (allies as number) <= ALLIES_RANGE.max;

/** What makes two players allies, whatever the admin chose. */
export interface Bond {
  /** Both are members of the same guild, and guilds are on in the round. */
  guild: boolean;
  /** Both are friends (#227). */
  friends: boolean;
}

/** Whether a bond makes two players allies under the setting `allies`. */
export const isAlly = (allies: number, bond: Bond): boolean =>
  (bond.guild && (allies & ALLIES.guild) !== 0) ||
  (bond.friends && (allies & ALLIES.friends) !== 0);

/** Why a fleet cannot hold at a planet, beyond the alliance. */
export type HoldLimitError = 'holdFleets' | 'holdPlayers';

/**
 * Whether one more fleet of `owner` may hold at a planet where the fleets
 * of `held` (one owner per fleet, holding or on its way to hold) are.
 */
export function holdLimitError(
  owner: string,
  held: readonly string[],
): HoldLimitError | undefined {
  if (held.length >= HOLD_LIMITS.fleets) return 'holdFleets';
  const players = new Set(held);
  return !players.has(owner) && players.size >= HOLD_LIMITS.players
    ? 'holdPlayers'
    : undefined;
}

/** When a fleet that holds flies home: its arrival plus its holding time. */
export const holdEnd = (f: Pick<Fleet, 'arr' | 'hold'>): number =>
  f.arr + (f.hold ?? 0);

/** When the next event of a fleet is due: its arrival, the end of holding or its return. */
export function dueAt(
  f: Pick<Fleet, 'state' | 'arr' | 'ret' | 'hold'>,
): number {
  if (f.state === 'out') return f.arr;
  return f.state === 'hold' ? holdEnd(f) : f.ret;
}

/** The sum of the cargo of several fleets. */
export const cargoOf = (fleets: readonly Pick<Fleet, 'cargo'>[]): Resources =>
  fleets.reduce(
    (sum, f) => ({
      m: sum.m + f.cargo.m,
      c: sum.c + f.cargo.c,
      d: sum.d + f.cargo.d,
    }),
    { m: 0, c: 0, d: 0 },
  );
