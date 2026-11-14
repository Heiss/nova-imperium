// Guild ranks with configurable rights (#163). Every guild action checks the
// rank of the acting member here, on the server; the client only hides what
// a rank may not do. Rules (owner, 2026-11-13; okf/features/guild-ranks.md):
// exactly one Leitung, which holds every right; ranks are ordered, a member
// acts only on lower ranks and gives only rights it holds; only the Leitung
// hands over the Leitung, chooses the default rank and dissolves the guild.
import {
  GUILD_RIGHTS,
  isGuildRight,
  MAX_GUILD_RANKS,
  MAX_RANK_NAME,
  MIN_RANK_NAME,
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

const NO_RIGHT = 'Dazu fehlt deinem Rang das Recht.';
const LOWER_ONLY = 'Das geht nur bei Rängen unter deinem.';
const LEAD_ONLY = 'Das darf nur die Gildenleitung.';

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
    position: lead ? 0 : (own?.position ?? Infinity),
    rights: new Set(lead ? GUILD_RIGHTS : (own?.rights ?? [])),
  };
}

export function need(a: Actor, right: GuildRight): void {
  if (!a.rights.has(right)) fail(NO_RIGHT);
}

/** Refuses a rank or member at `position` that is not below the actor. */
export function below(a: Actor, position: number): void {
  if (position <= a.position) fail(LOWER_ONLY);
}

function leadOnly(a: Actor, message = LEAD_ONLY): void {
  if (!a.lead) fail(message);
}

/** The place of a member of the actor's guild in the order. */
export function placeOf(a: Actor, m: Membership): number {
  if (m.user_id === a.guild.founder) return 0;
  return a.ranks.find((r) => r.id === m.rank_id)?.position ?? Infinity;
}

function rankOf(a: Actor, id: unknown): Rank {
  const rank = str(id, 40);
  return (
    a.ranks.find((r) => r.id === rank) ?? fail('Diesen Rang gibt es nicht.')
  );
}

/** A rank below the actor that it may change with the right „Ränge verwalten“. */
function managed(ctx: Ctx, uid: string, id: unknown) {
  const a = actor(ctx, uid);
  need(a, 'ranks');
  const rank = rankOf(a, id);
  below(a, rank.position);
  return { a, rank };
}

function rankName(a: Actor, value: unknown, except = ''): string {
  const name = str(value, MAX_RANK_NAME + 1);
  if (name.length < MIN_RANK_NAME || name.length > MAX_RANK_NAME)
    fail('Der Rangname braucht 2 bis 67 Zeichen.');
  const key = name.toLocaleLowerCase('de');
  if (
    a.ranks.some(
      (r) => r.id !== except && r.name.toLocaleLowerCase('de') === key,
    )
  )
    fail('Diesen Rangnamen gibt es in der Gilde schon.');
  return name;
}

function rightsOf(value: unknown): Set<GuildRight> {
  const list = Array.isArray(value) ? (value as unknown[]) : [null];
  if (!list.every(isGuildRight)) fail('Dieses Recht gibt es nicht.');
  return new Set(list as GuildRight[]);
}

export const createGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'ranks');
  if (a.ranks.length >= MAX_GUILD_RANKS)
    fail('Eine Gilde hat höchstens 25 Ränge.');
  ctx.guilds.addRank(ctx.id(), a.guild.id, rankName(a, d.name));
  return 'Rang angelegt.';
};

export const renameGuildRank: Action = (ctx, user, d) => {
  const { a, rank } = managed(ctx, user.id, d.rank);
  ctx.guilds.renameRank(rank.id, rankName(a, d.name, rank.id));
  return 'Rang umbenannt.';
};

export const setGuildRankRights: Action = (ctx, user, d) => {
  const { a, rank } = managed(ctx, user.id, d.rank);
  const next = rightsOf(d.rights);
  const changed = GUILD_RIGHTS.filter(
    (r) => next.has(r) !== rank.rights.includes(r),
  );
  if (changed.some((r) => !a.rights.has(r))) fail(NO_RIGHT);
  ctx.guilds.setRights(
    rank.id,
    GUILD_RIGHTS.filter((r) => next.has(r)),
  );
  return 'Rechte gespeichert.';
};

export const moveGuildRank: Action = (ctx, user, d) => {
  const { a, rank } = managed(ctx, user.id, d.rank);
  const at = a.ranks.indexOf(rank);
  const other =
    a.ranks[d.up === true ? at - 1 : at + 1] ??
    fail('Der Rang steht schon ganz unten.');
  below(a, other.position);
  ctx.guilds.swapRanks(rank, other);
  return 'Rang verschoben.';
};

export const deleteGuildRank: Action = (ctx, user, d) => {
  const { a, rank } = managed(ctx, user.id, d.rank);
  // The Leitung is never deletable (nobody is above it) and never the
  // default, so a guild keeps both and with them at least two ranks.
  const fallback = a.guild.default_rank!;
  if (rank.id === fallback)
    fail('Der Standardrang kann nicht gelöscht werden.');
  ctx.guilds.deleteRank(rank.id, fallback);
  return 'Rang gelöscht.';
};

export const setGuildDefaultRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  leadOnly(a);
  const rank = rankOf(a, d.rank);
  if (rank.position === 0)
    fail('Die Leitung kann nicht der Standardrang sein.');
  ctx.guilds.setDefaultRank(a.guild.id, rank.id);
  return 'Standardrang gesetzt.';
};

/** A member of the actor's guild other than an applicant. */
export function memberOf(ctx: Ctx, a: Actor, uid: unknown): Membership {
  const m = ctx.guilds.membership(str(uid, 40));
  if (m?.guild_id !== a.guild.id || m.status !== 'member')
    return fail('Dieses Gildenmitglied gibt es nicht.');
  return m;
}

export const assignGuildRank: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'assign');
  const target = memberOf(ctx, a, d.uid);
  below(a, placeOf(a, target));
  const rank = rankOf(a, d.rank);
  below(a, rank.position);
  ctx.guilds.setRank(target.user_id, rank.id);
  return 'Rang vergeben.';
};

/**
 * The rank the Leitung takes for itself when it hands over the Leitung
 * (owner, 2026-11-14): one of the guild, not the Leitung.
 */
export function handOverRank(a: Actor, id: unknown): Rank {
  leadOnly(a);
  const rank = rankOf(a, id);
  if (rank.position === 0) fail('Wähle für dich einen Rang unter der Leitung.');
  return rank;
}

/**
 * Dissolves the guild with all its members (owner, 2026-11-14): only the
 * Leitung, never a right, confirmed with the tag of the guild.
 */
export const dissolveGuild: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  leadOnly(a, 'Nur die Gildenleitung kann die Gilde auflösen.');
  if (str(d.tag, 30).toUpperCase() !== a.guild.tag.toUpperCase())
    fail('Das Kürzel stimmt nicht.');
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
