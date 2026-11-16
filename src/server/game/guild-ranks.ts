// Guild ranks with configurable rights (#163). Every guild action checks the
// rank of the acting member here, on the server; the client only hides what
// a rank may not do. Rules (owner, 2026-11-13; okf/features/guild-ranks.md):
// exactly one Leitung, which holds every right; ranks are ordered, a member
// acts only on lower ranks and gives only rights it holds; only the Leitung
// hands over the Leitung, chooses the default rank and dissolves the guild.
// The rules are plain functions in src/core/guild-ranks.ts, and the check of
// each action one function of src/core/guild-checks.ts (#214), which the
// guild view uses too; this file finds the actor, gathers the values and
// words the codes.
import {
  assignRankError,
  createRankError,
  defaultRankError,
  deleteRankError,
  dissolveError,
  findRank,
  moveRankError,
  renameRankError,
  rightsError,
  type ActorRule,
} from '../../core/guild-checks.ts';
import {
  GUILD_RIGHTS,
  MAX_RANK_NAME,
  memberPlace,
  type GuildRight,
} from '../../core/guild-ranks.ts';
import type {
  Guild,
  GuildPlayer,
  Membership,
  Rank,
} from '../db/repos/guilds.ts';
import type { Action } from './actions.ts';
import { fail, str, type Ctx } from './context.ts';
import { rankEvent } from './guild-events.ts';

/** The refusals the guild actions share (#163), by the codes of core/guild-checks.ts. */
export const GUILD_ERROR = {
  right: 'Dazu fehlt deinem Rang das Recht.',
  lower: 'Das geht nur bei Rängen unter deinem.',
  lead: 'Das darf nur die Gildenleitung.',
  rank: 'Diesen Rang gibt es nicht.',
  member: 'Dieses Gildenmitglied gibt es nicht.',
} as const;

/** Refuses with the message of `code`, if there is one (#214). */
export function refuse<C extends string>(
  code: C | null,
  messages: Readonly<Record<C, string>>,
): void {
  if (code) fail(messages[code]);
}

/** The acting member of a guild. */
export interface Actor {
  uid: string;
  guild: Guild;
  /** The ranks of the guild, highest first; the first is the Leitung. */
  ranks: Rank[];
  lead: boolean;
  /** The own rank as stored. */
  rank: string | null;
  /** Place of the own rank: 0 for the Leitung, Infinity without a rank. */
  position: number;
  rights: ReadonlySet<GuildRight>;
}

/** The member `uid` with its guild, rank and rights; refuses everyone else. */
export function actor(ctx: Ctx, uid: string): Actor {
  const member = ctx.guilds.membership(uid);
  if (member?.status !== 'member') return fail('Du bist in keiner Gilde.');
  const guild = ctx.guilds.get(member.guild_id)!;
  const ranks = ctx.guilds.ranks(guild.id);
  const lead = guild.founder === uid;
  const own = ranks.find((r) => r.id === member.rank_id);
  return {
    uid,
    guild,
    ranks,
    lead,
    rank: member.rank_id,
    position: memberPlace(lead, own?.position),
    // No rank, no right: a Set of nothing is empty.
    rights: new Set(lead ? GUILD_RIGHTS : own?.rights),
  };
}

/** The place of a member of the actor's guild in the order. */
export function placeOf(a: Actor, m: Membership): number {
  return memberPlace(
    m.user_id === a.guild.founder,
    a.ranks.find((r) => r.id === m.rank_id)?.position,
  );
}

/** The actor as the core checks see it: the Leitung or not, its place and its rights. */
export const asRule = (a: Actor): ActorRule => ({
  lead: a.lead,
  position: a.position,
  rights: [...a.rights],
});

/** The id of a rank as sent. */
export const rankId = (id: unknown): string => str(id, 40);

/** A rank name as sent; one character more than allowed is refused. */
const rankName = (value: unknown): string => str(value, MAX_RANK_NAME + 1);

const NAME_ERROR = {
  length: 'Der Rangname braucht 2 bis 67 Zeichen.',
  taken: 'Diesen Rangnamen gibt es in der Gilde schon.',
};

export const createGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const name = rankName(d.name);
  refuse(createRankError(asRule(a), a.ranks, name), {
    ...GUILD_ERROR,
    full: 'Eine Gilde hat höchstens 25 Ränge.',
    ...NAME_ERROR,
  });
  ctx.guilds.addRank(ctx.id(), a.guild.id, name);
  return 'Rang angelegt.';
};

export const renameGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const id = rankId(d.rank);
  const name = rankName(d.name);
  refuse(renameRankError(asRule(a), a.ranks, id, name), {
    ...GUILD_ERROR,
    ...NAME_ERROR,
  });
  ctx.guilds.renameRank(id, name);
  return 'Rang umbenannt.';
};

export const setGuildRankRights: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const id = rankId(d.rank);
  refuse(rightsError(asRule(a), a.ranks, id, d.rights), {
    ...GUILD_ERROR,
    unknown: 'Dieses Recht gibt es nicht.',
    change: GUILD_ERROR.right,
  });
  const next = d.rights as GuildRight[];
  ctx.guilds.setRights(
    id,
    GUILD_RIGHTS.filter((r) => next.includes(r)),
  );
  return 'Rechte gespeichert.';
};

export const moveGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const id = rankId(d.rank);
  const up = d.up === true;
  refuse(moveRankError(asRule(a), a.ranks, id, up), {
    ...GUILD_ERROR,
    end: 'Der Rang steht schon ganz unten.',
  });
  const at = a.ranks.findIndex((r) => r.id === id);
  ctx.guilds.swapRanks(a.ranks[at]!, a.ranks[up ? at - 1 : at + 1]!);
  return 'Rang verschoben.';
};

export const deleteGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const id = rankId(d.rank);
  // The Leitung is never deletable (nobody is above it) and never the
  // default, so a guild keeps both and with them at least two ranks. Its
  // members move to the default rank: only one the actor could give them
  // (owner, 2026-11-14).
  const fallback = a.guild.default_rank!;
  const error = deleteRankError(
    asRule(a),
    a.ranks,
    id,
    fallback,
    ctx.guilds.rankHasMembers(id),
  );
  refuse(error, {
    ...GUILD_ERROR,
    default: 'Der Standardrang kann nicht gelöscht werden.',
    members:
      'Der Rang hat Mitglieder, und der Standardrang steht nicht unter deinem oder hat ein Recht, das dir fehlt.',
  });
  const moved = findRank(a.ranks, fallback)!;
  // Rank ids are unique, so the rank's members are of the guild.
  const members = ctx.guilds.players().filter((p) => p.rank_id === id);
  ctx.guilds.deleteRank(id, fallback);
  // Each of its members has a new rank (#169 D4).
  for (const p of members)
    rankEvent(ctx, a.guild.id, p.id, moved.name, user.id);
  return 'Rang gelöscht.';
};

export const setGuildDefaultRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const id = rankId(d.rank);
  refuse(defaultRankError(asRule(a), a.ranks, id), {
    ...GUILD_ERROR,
    leitung: 'Die Leitung kann nicht der Standardrang sein.',
  });
  ctx.guilds.setDefaultRank(a.guild.id, id);
  return 'Standardrang gesetzt.';
};

/** A member of the actor's guild other than an applicant, if `uid` is one. */
export function memberOf(
  ctx: Ctx,
  a: Actor,
  uid: unknown,
): Membership | undefined {
  const m = ctx.guilds.membership(str(uid, 40));
  return m?.guild_id === a.guild.id && m.status === 'member' ? m : undefined;
}

export const assignGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const target = memberOf(ctx, a, d.uid);
  const id = rankId(d.rank);
  // Not below, or a right the actor lacks (owner, 2026-11-14).
  refuse(
    assignRankError(asRule(a), target && placeOf(a, target), a.ranks, id),
    { ...GUILD_ERROR, rights: GUILD_ERROR.right },
  );
  const member = target!;
  const rank = findRank(a.ranks, id)!;
  ctx.guilds.setRank(member.user_id, rank.id);
  // A new rank is an event of the chat (#169 D4); the same rank is none.
  if (member.rank_id !== rank.id)
    rankEvent(ctx, a.guild.id, member.user_id, rank.name, user.id);
  return 'Rang vergeben.';
};

/**
 * Dissolves the guild with all its members (owner, 2026-11-14): only the
 * Leitung, never a right, confirmed with the tag of the guild.
 */
export const dissolveGuild: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  refuse(dissolveError(asRule(a), str(d.tag, 30), a.guild.tag), {
    lead: 'Nur die Gildenleitung kann die Gilde auflösen.',
    tag: 'Das Kürzel stimmt nicht.',
  });
  ctx.guilds.delete(a.guild.id);
  return 'Gilde aufgelöst.';
};

/** The ranks for the members of the guild; outsiders see none (owner, D7). */
export function rankState(a: Actor, players: GuildPlayer[]) {
  const members = players.filter(
    (p) => p.guild_id === a.guild.id && p.status === 'member',
  );
  return {
    lead: a.guild.founder,
    rank: a.rank,
    rights: GUILD_RIGHTS.filter((r) => a.rights.has(r)),
    default: a.guild.default_rank,
    list: a.ranks.map((r) => ({
      id: r.id,
      name: r.name,
      rights: r.position === 0 ? [...GUILD_RIGHTS] : r.rights,
    })),
    members: Object.fromEntries(members.map((p) => [p.id, p.rank_id])),
  };
}
