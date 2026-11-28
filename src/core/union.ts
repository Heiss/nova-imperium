// The attack union („Verbandsangriff“, #225, #466, okf/features/holding-acs.md):
// a union has a fixed arrival X (owner, 2026-11-28, 1c); its leader invites
// allies, and they join with fleets of their own that start at once and fly
// at the speed that brings them there exactly at X (7b). All fleets of a
// union arrive together and fight as several attackers in one battle. The
// classic limits are the defaults of the round (owner, 2026-11-16, D3): at
// most 16 fleets of at most 5 players; an extra cut-off „no joining in the
// last N minutes“ is off by default (owner, 2026-11-17) and stays (8a); the
// delay of the classic 30 % rule went with the fixed X (8a). The union is a
// switch of the round (4). The rules are pure; the server asks them
// (src/server/game/union.ts), the browser reads the same values from the
// round.
import { flightMs } from './flight.ts';
import { LIVE_SWITCH } from './live-switch.ts';
import type { RoundSetting } from './round.ts';
import type { Resources, Universe } from './types.ts';

/** One minute in milliseconds. */
const MINUTE_MS = 60_000;

/** The classic values (owner, 2026-11-16, D3, owiki „Allianzkampfsystem“). */
export const UNION_DEFAULTS = {
  fleets: 16,
  players: 5,
  cutoff: 0,
} as const;

/** The ranges of the settings [V]: the owner named only the defaults. */
export const UNION_RANGES = {
  fleets: { min: 1, max: 50 },
  players: { min: 1, max: 20 },
  cutoff: { min: 0, max: 1440 },
} as const;

/**
 * The heading of these settings in the admin panel (#357), the name the game
 * uses for the feature: the changelog entry „Verbandsangriff“ [V].
 */
export const roundHeading = 'Verbandsangriff';

/**
 * The settings of the attack union as entries of the registry of the round
 * settings (#283, #310): number fields of the dialog „Neue Runde“ and,
 * `live`, rows of the universe settings (owner, 2026-11-17, X1). The order
 * numbers 200 to 240 follow the 100 and 110 of holding by a gap; 220, the
 * delay, went with #466 (8a).
 */
export const roundSettings = [
  {
    kind: 'number',
    key: 'roundUnionFleets',
    name: 'unionFleets',
    label: 'Verbandsangriff: höchstens Flotten',
    order: 200,
    ...UNION_RANGES.fleets,
    def: UNION_DEFAULTS.fleets,
    live: true,
  },
  {
    kind: 'number',
    key: 'roundUnionPlayers',
    name: 'unionPlayers',
    label: 'Verbandsangriff: höchstens Spieler',
    order: 210,
    ...UNION_RANGES.players,
    def: UNION_DEFAULTS.players,
    live: true,
  },
  {
    kind: 'number',
    key: 'roundUnionCutoff',
    name: 'unionCutoff',
    label: 'Verbandsangriff: kein Beitritt in den letzten Minuten (0 = aus)',
    order: 230,
    ...UNION_RANGES.cutoff,
    def: UNION_DEFAULTS.cutoff,
    live: true,
  },
  {
    // The switch of the round (#466, owner, 2026-11-28, 4;
    // okf/ops/feature-switches.md), live like „Wache stellen“: a number of 1
    // (An) and 0 (Aus), because a switch of the registry cannot be live. A
    // universe without the key reads the default, „An“ (261a).
    kind: 'number',
    key: 'roundUnionOn',
    name: 'unionOn',
    label: 'Verbandsangriff',
    order: 240,
    ...LIVE_SWITCH,
  },
] as const satisfies readonly RoundSetting[];

/**
 * Whether the attack union is on in the round (#466): „An“ by default, so a
 * round without the value is on. Off, nobody plans, invites or joins; what
 * flies arrives.
 */
export const unionOpen = (round: { unionOn?: number }): boolean =>
  (round.unionOn ?? 1) !== 0;

/** The refusal while the switch is off [V], as the one of „Wache stellen“. */
export const UNION_OFF_REFUSAL =
  'Verbandsangriffe sind in dieser Runde abgeschaltet.';

/** The limits of the round, as the settings hold them. */
export interface UnionLimits {
  fleets: number;
  players: number;
  /** No joining in the last minutes before the arrival; 0 is off. */
  cutoff: number;
}

/** Why a fleet cannot join a union (besides the checks of every attack). */
export type JoinError =
  'closed' | 'cutoff' | 'early' | 'late' | 'fleets' | 'players' | 'notInvited';

/**
 * The message of each refusal of a joining fleet [V]; the server and the
 * fleet form say the same. `earliest` words the earliest start of a fleet
 * that would be there too early (#466, 7b).
 */
export const joinMessage = (
  error: JoinError,
  limits: Pick<UnionLimits, 'fleets' | 'players' | 'cutoff'>,
  earliest = '',
): string =>
  ({
    closed: 'Der Angriffsverband ist schon angekommen.',
    cutoff: `In den letzten ${limits.cutoff} Minuten vor der Ankunft tritt niemand mehr bei.`,
    early: `Deine Flotte wäre selbst mit 10 % zu früh da. Schicke sie frühestens ${earliest} los.`,
    late: 'Deine Flotte erreicht das Ziel selbst mit 100 % nicht bis zur Ankunft des Verbands.',
    fleets: `Am Angriffsverband nehmen bereits ${limits.fleets} Flotten teil.`,
    players: `Am Angriffsverband nehmen bereits ${limits.players} Spieler teil.`,
    notInvited: 'Du bist nicht zu diesem Angriffsverband eingeladen.',
  })[error];

/** The union a joining fleet meets: its fleets' owners (one per fleet), its leader, its invited. */
export interface UnionFacts {
  leader: string;
  /** The owner of each fleet in the union, the leader's first. */
  owners: readonly string[];
  /** The players invited and not yet in the union. */
  invited: readonly string[];
}

/**
 * Whether `joiner` may bring one more fleet: the leader and a player who is
 * in the union already need no invitation, everyone else needs one (an ally
 * is checked by the server); then the limits of fleets and players.
 */
export function joinLimitError(
  union: UnionFacts,
  joiner: string,
  limits: Pick<UnionLimits, 'fleets' | 'players'>,
): Extract<JoinError, 'fleets' | 'players' | 'notInvited'> | undefined {
  const members = new Set(union.owners);
  if (!members.has(joiner) && !union.invited.includes(joiner))
    return 'notInvited';
  if (union.owners.length >= limits.fleets) return 'fleets';
  return !members.has(joiner) && members.size >= limits.players
    ? 'players'
    : undefined;
}

/**
 * Whether the leader may invite one more player: the players of the union
 * and the invited count against the limit of players, so no invitation can
 * be left without a place.
 */
export function inviteLimitError(
  union: UnionFacts,
  invitee: string,
  limits: Pick<UnionLimits, 'players'>,
): 'players' | undefined {
  const all = new Set([...union.owners, ...union.invited]);
  return !all.has(invitee) && all.size >= limits.players
    ? 'players'
    : undefined;
}

/**
 * Why a leader cannot plan a union arriving at `arr` at `now` (#466, A1a):
 * X lies in the past, or within the cut-off, where nobody could join [V].
 */
export function planError(x: {
  now: number;
  arr: number;
  limits: Pick<UnionLimits, 'cutoff'>;
}): 'past' | 'cutoff' | undefined {
  if (!(x.arr > x.now)) return 'past';
  return joinWindow(x) ? 'cutoff' : undefined;
}

/** The message of a refused plan [V]; the server and the fleet form say the same. */
export const planMessage = (
  error: 'past' | 'cutoff',
  limits: Pick<UnionLimits, 'cutoff'>,
): string =>
  error === 'past'
    ? 'Die Ankunft muss in der Zukunft liegen.'
    : `Die Ankunft muss mehr als ${limits.cutoff} Minuten in der Zukunft liegen, sonst kann niemand mehr beitreten.`;

/**
 * Whether a fleet may still join at `now` a union that arrives at `arr`
 * (#466): a union that has arrived is closed; within the last `cutoff`
 * minutes nobody joins (the boundary counts as inside [V]). The speed that
 * brings the fleet there at `arr` is `unionFlight`'s.
 */
export function joinWindow(x: {
  now: number;
  arr: number;
  limits: Pick<UnionLimits, 'cutoff'>;
}): 'closed' | 'cutoff' | undefined {
  const left = x.arr - x.now;
  if (left <= 0) return 'closed';
  return left <= x.limits.cutoff * MINUTE_MS ? 'cutoff' : undefined;
}

/** The slowest and the fastest speed of a fleet, in tenths (10 % and 100 %). */
export const SLOWEST = 1;
export const FASTEST = 10;

/** How a fleet that joins a union flies, or why it cannot make the arrival. */
export type UnionFlight =
  { pct: number } | { error: 'early'; earliest: number } | { error: 'late' };

/**
 * The speed of a fleet that starts at `now` and joins a union arriving at
 * `arr` (#466, owner, 2026-11-28, 7b): it starts at once, and the server
 * picks its speed between 10 % and 100 %, also between the steps of the
 * form, so that its flight takes exactly the time left. The speed is the
 * inverse of `flightMs`: `((35000 / pct) · √(10 · dist / speed) + 10) /
 * universe speed` seconds. Too early even at 10 % is refused with the
 * earliest start; too late even at 100 % is refused [V]. The boundaries are
 * inside. The fleet's arrival is set to `arr` itself, so the rounding of
 * the milliseconds never moves it.
 */
export function unionFlight(x: {
  dist: number;
  speed: number;
  universe: Universe;
  now: number;
  arr: number;
}): UnionFlight {
  const left = x.arr - x.now;
  const slowest = flightMs(x.dist, x.speed, SLOWEST, x.universe);
  if (left > slowest) return { error: 'early', earliest: x.arr - slowest };
  if (left < flightMs(x.dist, x.speed, FASTEST, x.universe))
    return { error: 'late' };
  const drive = 35000 * Math.sqrt((x.dist * 10) / x.speed);
  const pct = drive / ((left * x.universe.speed) / 1000 - 10);
  return { pct: Math.min(FASTEST, Math.max(SLOWEST, pct)) };
}

/**
 * The loot of a won battle split between the fleets of the union by their
 * free cargo space (owner, 2026-11-16, Q1): each resource in proportion to
 * the space, rounded down; the units the rounding leaves go one by one to
 * the first fleets that still have room, a fleet never gets more than it
 * can carry. What fits nowhere is not given out.
 */
export function splitLoot(
  loot: Resources,
  free: readonly number[],
): Resources[] {
  const total = free.reduce((s, n) => s + n, 0);
  const shares = free.map(() => ({ m: 0, c: 0, d: 0 }));
  if (total <= 0) return shares;
  const room = free.map((n) => Math.max(0, Math.floor(n)));
  const used = (i: number): number =>
    shares[i]!.m + shares[i]!.c + shares[i]!.d;
  const keys = ['m', 'c', 'd'] as const;
  // Every key is set by the first loop below.
  const rest = {} as Resources;
  for (const k of keys) {
    let given = 0;
    free.forEach((n, i) => {
      const part = Math.floor((loot[k] * n) / total);
      shares[i]![k] = part;
      given += part;
    });
    rest[k] = Math.floor(loot[k]) - given;
  }
  for (const k of keys)
    for (const [i, share] of shares.entries()) {
      const add = Math.max(0, Math.min(rest[k], room[i]! - used(i)));
      share[k] += add;
      rest[k] -= add;
    }
  return shares;
}
