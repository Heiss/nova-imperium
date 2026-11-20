// The attack union („Verbandsangriff“, #225, okf/features/holding-acs.md): a
// player opens a union from an own Sturmangriff on its way, invites allies,
// and they join with fleets of their own. All fleets of a union arrive
// together and fight as several attackers in one battle. The classic limits
// are the defaults of the round (owner, 2026-11-16, D3): at most 16 fleets
// of at most 5 players, and a joining fleet may delay the union by at most
// 30 % of the remaining flight time; an extra cut-off „no joining in the last
// N minutes“ is off by default (owner, 2026-11-17). The rules are pure; the
// server asks them (src/server/game/union.ts), the browser reads the same
// values from the round.
import type { RoundSetting } from './round.ts';
import type { Fleet, Resources } from './types.ts';

/** One minute in milliseconds. */
const MINUTE_MS = 60_000;

/** The classic values (owner, 2026-11-16, D3, owiki „Allianzkampfsystem“). */
export const UNION_DEFAULTS = {
  fleets: 16,
  players: 5,
  delay: 30,
  cutoff: 0,
} as const;

/** The ranges of the four settings [V]: the owner named only the defaults. */
export const UNION_RANGES = {
  fleets: { min: 1, max: 50 },
  players: { min: 1, max: 20 },
  delay: { min: 0, max: 100 },
  cutoff: { min: 0, max: 1440 },
} as const;

/**
 * The four settings of the attack union as entries of the registry of the
 * round settings (#283, #310): number fields of the dialog „Neue Runde“
 * and, `live`, rows of the universe settings (owner, 2026-11-17, X1). The
 * order numbers 200 to 230 follow the 100 and 110 of holding by a gap.
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
    key: 'roundUnionDelay',
    name: 'unionDelay',
    label: 'Verbandsangriff: Verspätung in Prozent der Restflugzeit',
    order: 220,
    ...UNION_RANGES.delay,
    def: UNION_DEFAULTS.delay,
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
] as const satisfies readonly RoundSetting[];

/** The limits of the round, as the settings hold them. */
export interface UnionLimits {
  fleets: number;
  players: number;
  /** The most a joining fleet delays the union, in percent of the remaining flight time. */
  delay: number;
  /** No joining in the last minutes before the arrival; 0 is off. */
  cutoff: number;
}

/** Why an attack cannot open a union. */
export type FoundError = 'notAttack' | 'notOut' | 'started' | 'inUnion';

/**
 * Whether an own fleet can open a union at `now`: a Sturmangriff on its way
 * out that has not arrived yet, no gift, not recalled and not in a union
 * already.
 */
export function foundError(
  f: Pick<Fleet, 'mission' | 'state' | 'arr' | 'recalled' | 'gift'>,
  now: number,
  inUnion: boolean,
): FoundError | undefined {
  if (f.mission !== 'attack') return 'notAttack';
  if (f.state !== 'out' || f.recalled || f.gift) return 'notOut';
  if (f.arr <= now) return 'started';
  return inUnion ? 'inUnion' : undefined;
}

/** Why a fleet cannot join a union (besides the checks of every attack). */
export type JoinError =
  'closed' | 'cutoff' | 'delay' | 'fleets' | 'players' | 'notInvited';

/** The message of each refusal of a joining fleet [V]; the server and the fleet form say the same. */
export const joinMessage = (
  error: JoinError,
  limits: Pick<UnionLimits, 'fleets' | 'players' | 'delay' | 'cutoff'>,
): string =>
  ({
    closed: 'Der Angriffsverband ist schon angekommen.',
    cutoff: `In den letzten ${limits.cutoff} Minuten vor der Ankunft tritt niemand mehr bei.`,
    delay: `Deine Flotte käme zu spät: Sie würde den Angriffsverband um mehr als ${limits.delay} % der Restflugzeit verzögern.`,
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

/** What a joining fleet makes of the arrival of the union. */
export type Timing = { arr: number } | { error: 'closed' | 'cutoff' | 'delay' };

/**
 * The arrival of the union once a fleet with the flight time `flight` joins
 * at `now` (okf/features/holding-acs.md, classic and the owner's decisions):
 * a union that has arrived is closed; within the last `cutoff` minutes
 * nobody joins (the boundary counts as inside [V]); a fleet that is there in
 * time waits and arrives with the others; a fleet that would arrive later
 * delays the union, by at most `delay` percent of the flight time that is
 * left, else it is refused.
 */
export function joinTiming(x: {
  now: number;
  arr: number;
  flight: number;
  limits: Pick<UnionLimits, 'delay' | 'cutoff'>;
}): Timing {
  const left = x.arr - x.now;
  if (left <= 0) return { error: 'closed' };
  if (left <= x.limits.cutoff * MINUTE_MS) return { error: 'cutoff' };
  // The union never arrives earlier than it did; a later fleet delays it.
  const arr = Math.max(x.arr, x.now + x.flight);
  return (arr - x.arr) * 100 <= x.limits.delay * left
    ? { arr }
    : { error: 'delay' };
}

/** The fleet with the arrival and the return moved by `ms`: what a delay does to the fleets already in the union. */
export const delayed = (
  f: Pick<Fleet, 'arr' | 'ret'>,
  ms: number,
): Pick<Fleet, 'arr' | 'ret'> => ({ arr: f.arr + ms, ret: f.ret + ms });

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
