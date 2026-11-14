// Guild ranks (#163): the rights a rank can hold and the limits of the
// ranks. Shared by the server, which checks every action, and the client,
// which shows only what the own rank may do. See okf/features/guild-ranks.md.

/**
 * The rights a rank can be given (owner, 2026-11-13). The Leitung holds all
 * of them. Dissolving the guild, handing over the Leitung and choosing the
 * default rank are no rights: only the Leitung does them. The right for
 * markers on the situation map comes with #160.
 */
export const GUILD_RIGHTS = [
  'applications',
  'remove',
  'assign',
  'profile',
  'ranks',
] as const;

export type GuildRight = (typeof GUILD_RIGHTS)[number];

export const isGuildRight = (v: unknown): v is GuildRight =>
  (GUILD_RIGHTS as readonly unknown[]).includes(v);

/** At most this many ranks per guild, the Leitung included (owner, 2026-11-13). */
export const MAX_GUILD_RANKS = 25;
/** Longest rank name (owner, 2026-11-13). */
export const MAX_RANK_NAME = 67;
/** Shortest rank name: a proposal, the owner set only the maximum. */
export const MIN_RANK_NAME = 2;
