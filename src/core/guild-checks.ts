// The checks of the guild actions (#214, patterns, section 7): one pure
// function per action that returns the code of its first refusal, in the
// order the server has always checked, or null. The server words each code
// (guilds.ts, guild-ranks.ts in src/server/game); the guild view asks the
// same functions where it hides what the own rank may not do. The rank rules
// themselves stay in guild-ranks.ts (#163) and are the parts used here.
// Finding the acting member and its guild stays on the server (`actor`).
import {
  assignError,
  belowLeitung,
  canChangeRights,
  deleteError,
  isBelow,
  isGuildRight,
  MAX_GUILD_RANKS,
  rankNameError,
  type RankRule,
} from './guild-ranks.ts';

/** Shortest and longest tag of a guild, letters and digits (#68). */
export const MIN_GUILD_TAG = 2;
export const MAX_GUILD_TAG = 8;
/** Shortest and longest name of a guild (#68). */
export const MIN_GUILD_NAME = 3;
export const MAX_GUILD_NAME = 32;
/** Longest profile text of a guild, Markdown (#68). */
export const MAX_GUILD_TEXT = 6000;

const TAG = new RegExp(`^[A-Z0-9]{${MIN_GUILD_TAG},${MAX_GUILD_TAG}}$`);

/** The acting member: its place, its rights, and whether it is the Leitung. */
export interface ActorRule extends RankRule {
  lead: boolean;
}

/** A rank of the guild with its place; a guild lists them highest first. */
export interface RankEntry extends RankRule {
  id: string;
  name: string;
}

/** The profile of a guild as sent: the tag in upper case, all trimmed. */
export interface GuildProfile {
  tag: string;
  name: string;
  description: string;
}

/** A refused profile: the tag, the name, the text, or tag or name taken. */
export type ProfileError = 'tag' | 'name' | 'text' | 'taken';

/** The profile of a guild; `taken` whether another guild has its tag or name. */
export function profileError(
  p: GuildProfile,
  taken: boolean,
): ProfileError | null {
  if (!TAG.test(p.tag)) return 'tag';
  if (p.name.length < MIN_GUILD_NAME || p.name.length > MAX_GUILD_NAME)
    return 'name';
  if (p.description.length > MAX_GUILD_TEXT) return 'text';
  return taken ? 'taken' : null;
}

/** `createGuild`: in no guild and without an application, then the profile. */
export const createGuildError = (
  joined: boolean,
  p: GuildProfile,
  taken: boolean,
): 'member' | ProfileError | null =>
  joined ? 'member' : profileError(p, taken);

/** `updateGuild`: the right „profile“, then the profile. */
export const updateGuildError = (
  actor: RankRule,
  p: GuildProfile,
  taken: boolean,
): 'right' | ProfileError | null =>
  actor.rights.includes('profile') ? profileError(p, taken) : 'right';

/** `applyToGuild`: in no guild and without an application, to a guild that exists. */
export function applyError(
  joined: boolean,
  exists: boolean,
): 'member' | 'guild' | null {
  if (joined) return 'member';
  return exists ? null : 'guild';
}

/** `reviewGuildApplication`: the right „applications“, an open application to the guild. */
export function reviewError(
  actor: RankRule,
  open: boolean,
): 'right' | 'application' | null {
  if (!actor.rights.includes('applications')) return 'right';
  return open ? null : 'application';
}

/**
 * `leaveGuild`: a member or an applicant; the Leitung only without other
 * members, and then the guild is dissolved.
 */
export function leaveError(
  joined: boolean,
  lead: boolean,
  others: boolean,
): 'none' | 'handover' | null {
  if (!joined) return 'none';
  return lead && others ? 'handover' : null;
}

/** The rank with the id `id`, if the guild has one. */
export const findRank = <R extends { id: string }>(
  ranks: readonly R[],
  id: unknown,
): R | undefined => ranks.find((r) => r.id === id);

/** Another member of the actor's guild: its place, and whether it is the actor. */
export interface MemberTarget {
  place: number;
  self: boolean;
}

/**
 * `manageGuildMember`: a member of the guild other than the actor; to hand
 * over the Leitung, the Leitung chooses its own new rank below the Leitung
 * (`transfer`, the ranks and the chosen id); to remove the member, the right
 * „remove“ and the member below the actor (`transfer` null).
 */
export function manageMemberError(
  actor: ActorRule,
  target: MemberTarget | undefined,
  transfer: { ranks: readonly RankEntry[]; rank: unknown } | null,
): 'member' | 'lead' | 'rank' | 'leitung' | 'right' | 'lower' | null {
  if (!target || target.self) return 'member';
  if (transfer) return defaultRankError(actor, transfer.ranks, transfer.rank);
  if (!actor.rights.includes('remove')) return 'right';
  return isBelow(actor.position, target.place) ? null : 'lower';
}

/**
 * A rank below the actor that the actor may change: the right „ranks“, a
 * rank of the guild, below the actor. The first part of every rank action
 * but creating one.
 */
export function managedError(
  actor: RankRule,
  ranks: readonly RankEntry[],
  id: unknown,
): 'right' | 'rank' | 'lower' | null {
  if (!actor.rights.includes('ranks')) return 'right';
  const rank = findRank(ranks, id);
  if (!rank) return 'rank';
  return isBelow(actor.position, rank.position) ? null : 'lower';
}

/** The first part of `createGuildRank`, which the guild view asks too: the right „ranks“, room for one more. */
export function rankRoomError(
  actor: RankRule,
  ranks: readonly RankEntry[],
): 'right' | 'full' | null {
  if (!actor.rights.includes('ranks')) return 'right';
  return ranks.length >= MAX_GUILD_RANKS ? 'full' : null;
}

/** `createGuildRank`: the right „ranks“, room for one more, then the name. */
export const createRankError = (
  actor: RankRule,
  ranks: readonly RankEntry[],
  name: string,
): 'right' | 'full' | 'length' | 'taken' | null =>
  rankRoomError(actor, ranks) ?? rankNameError(name, ranks);

/** `renameGuildRank`: a rank the actor may change, then the name. */
export const renameRankError = (
  actor: RankRule,
  ranks: readonly RankEntry[],
  id: unknown,
  name: string,
): 'right' | 'rank' | 'lower' | 'length' | 'taken' | null =>
  managedError(actor, ranks, id) ?? rankNameError(name, ranks, id as string);

/**
 * `setGuildRankRights`: a rank the actor may change; `next` a list of known
 * rights; and only rights the actor holds change (`canChangeRights`).
 */
export function rightsError(
  actor: RankRule,
  ranks: readonly RankEntry[],
  id: unknown,
  next: unknown,
): 'right' | 'rank' | 'lower' | 'unknown' | 'change' | null {
  const managed = managedError(actor, ranks, id);
  if (managed) return managed;
  if (!Array.isArray(next) || !next.every(isGuildRight)) return 'unknown';
  return canChangeRights(actor.rights, findRank(ranks, id)!.rights, next)
    ? null
    : 'change';
}

/**
 * `moveGuildRank`: a rank the actor may change, a neighbour above (`up`) or
 * below it, and that neighbour below the actor too.
 */
export function moveRankError(
  actor: RankRule,
  ranks: readonly RankEntry[],
  id: unknown,
  up: boolean,
): 'right' | 'rank' | 'lower' | 'end' | null {
  const managed = managedError(actor, ranks, id);
  if (managed) return managed;
  const at = ranks.findIndex((r) => r.id === id);
  const other = ranks[up ? at - 1 : at + 1];
  if (!other) return 'end';
  return isBelow(actor.position, other.position) ? null : 'lower';
}

/**
 * `deleteGuildRank`: a rank the actor may change, not the default rank
 * `fallback`; a rank with members only when the actor could give their new
 * rank, the default one (`deleteError`).
 */
export function deleteRankError(
  actor: RankRule,
  ranks: readonly RankEntry[],
  id: unknown,
  fallback: string | null,
  hasMembers: boolean,
): 'right' | 'rank' | 'lower' | 'default' | 'members' | null {
  const managed = managedError(actor, ranks, id);
  if (managed) return managed;
  if (id === fallback) return 'default';
  if (!hasMembers) return null;
  const moved = findRank(ranks, fallback);
  return !moved || deleteError(actor, true, moved) ? 'members' : null;
}

/**
 * `setGuildDefaultRank`, and the own new rank of the Leitung when it hands
 * over: only the Leitung, a rank of the guild below the Leitung.
 */
export function defaultRankError(
  actor: ActorRule,
  ranks: readonly RankEntry[],
  id: unknown,
): 'lead' | 'rank' | 'leitung' | null {
  if (!actor.lead) return 'lead';
  const rank = findRank(ranks, id);
  if (!rank) return 'rank';
  return belowLeitung(rank.position) ? null : 'leitung';
}

/**
 * `assignGuildRank`: the right „assign“, a member of the guild at place
 * `member`, a rank of the guild, and `assignError` (both below the actor,
 * no right the actor lacks).
 */
export function assignRankError(
  actor: RankRule,
  member: number | undefined,
  ranks: readonly RankEntry[],
  id: unknown,
): 'right' | 'member' | 'rank' | 'lower' | 'rights' | null {
  if (!actor.rights.includes('assign')) return 'right';
  if (member === undefined) return 'member';
  const rank = findRank(ranks, id);
  if (!rank) return 'rank';
  return assignError(actor, member, rank);
}

/** `dissolveGuild`: only the Leitung, confirmed with the tag in any case. */
export function dissolveError(
  actor: ActorRule,
  tag: string,
  guildTag: string,
): 'lead' | 'tag' | null {
  if (!actor.lead) return 'lead';
  return tag.toUpperCase() === guildTag.toUpperCase() ? null : 'tag';
}
