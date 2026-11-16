// Guild ranks (#163): the rights a rank can hold and the limits of the
// ranks. Shared by the server, which checks every action, and the client,
// which shows only what the own rank may do. See okf/features/guild-ranks.md.

/**
 * The rights a rank can be given (owner, 2026-11-13). The Leitung holds all
 * of them. Dissolving the guild, handing over the Leitung and choosing the
 * default rank are no rights: only the Leitung does them. The right for
 * markers on the situation map comes with #160. The three rights of the
 * guild chat come with #169 (owner, 2026-11-14, D2): „Chat lesen“, „Chat
 * schreiben“ and „Chatnachrichten löschen“.
 */
export const GUILD_RIGHTS = [
  'applications',
  'remove',
  'assign',
  'profile',
  'ranks',
  'chat-read',
  'chat-write',
  'chat-delete',
] as const;

export type GuildRight = (typeof GUILD_RIGHTS)[number];

export const isGuildRight = (v: unknown): v is GuildRight =>
  (GUILD_RIGHTS as readonly unknown[]).includes(v);

/**
 * The rights of the first default rank „Mitglied“ of a new guild: reading
 * and writing in the chat (owner, 2026-11-14, #169 D2).
 */
export const MEMBER_RIGHTS: readonly GuildRight[] = ['chat-read', 'chat-write'];

/** At most this many ranks per guild, the Leitung included (owner, 2026-11-13). */
export const MAX_GUILD_RANKS = 25;
/** Longest rank name (owner, 2026-11-13). */
export const MAX_RANK_NAME = 67;
/** Shortest rank name (owner, 2026-11-14). */
export const MIN_RANK_NAME = 2;

// The rules below take plain values (owner, 2026-11-14: the rules in the
// core, the server and the guild view use them). A place is 0 for the
// Leitung, a larger number for a lower rank, Infinity for no known rank.

/** The rights in `rights` that `holder` lacks. */
export const missingRights = (
  holder: readonly GuildRight[],
  rights: readonly GuildRight[],
): GuildRight[] => rights.filter((r) => !holder.includes(r));

/** The rights set in one list and not in the other, in the order of GUILD_RIGHTS. */
export const changedRights = (
  current: readonly GuildRight[],
  next: readonly GuildRight[],
): GuildRight[] =>
  GUILD_RIGHTS.filter((r) => next.includes(r) !== current.includes(r));

/** A member changes only rights it holds: it neither gives nor takes another. */
export const canChangeRights = (
  holder: readonly GuildRight[],
  current: readonly GuildRight[],
  next: readonly GuildRight[],
): boolean => missingRights(holder, changedRights(current, next)).length === 0;

/** The place of a member: the Leitung at 0, a member without a known rank lowest. */
export const memberPlace = (lead: boolean, position?: number): number =>
  lead ? 0 : (position ?? Infinity);

/** Whether `position` is strictly below `own`: equals are not below. */
export const isBelow = (own: number, position: number): boolean =>
  position > own;

/** A rank below the Leitung: only such a rank is a default rank or the old Leitung's. */
export const belowLeitung = (position: number): boolean => isBelow(0, position);

/** A rank: its place and its rights. */
export interface RankRule {
  position: number;
  rights: readonly GuildRight[];
}

/**
 * Giving `rank` to a member at place `member` (owner, 2026-11-14): the
 * member and the rank below the actor, and no right in the rank that the
 * actor lacks. An error code, or null.
 */
export function assignError(
  actor: RankRule,
  member: number,
  rank: RankRule,
): 'lower' | 'rights' | null {
  if (
    !isBelow(actor.position, member) ||
    !isBelow(actor.position, rank.position)
  )
    return 'lower';
  return missingRights(actor.rights, rank.rights).length ? 'rights' : null;
}

/**
 * Deleting a rank (owner, 2026-11-14): its members move to the default
 * rank, so that rank must be below the actor and hold no right the actor
 * lacks, as when the actor gives it. A rank without members goes freely;
 * the Leitung holds every right and every default rank is below it.
 */
export function deleteError(
  actor: RankRule,
  hasMembers: boolean,
  fallback: RankRule,
): 'default' | null {
  if (!hasMembers) return null;
  return assignError(actor, Infinity, fallback) ? 'default' : null;
}

/**
 * A rank name of `MIN_RANK_NAME` to `MAX_RANK_NAME` characters that no
 * other rank of the guild has, in any case. `except` is the rank renamed.
 */
export function rankNameError(
  name: string,
  ranks: readonly { id: string; name: string }[],
  except?: string,
): 'length' | 'taken' | null {
  if (name.length < MIN_RANK_NAME || name.length > MAX_RANK_NAME)
    return 'length';
  const key = name.toLocaleLowerCase('de');
  return ranks.some(
    (r) => r.id !== except && r.name.toLocaleLowerCase('de') === key,
  )
    ? 'taken'
    : null;
}
