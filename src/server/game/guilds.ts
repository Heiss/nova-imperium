import type { Guild as PublicGuild } from '../../core/state/guilds.ts';
import { highscoreShows, SHOWS } from '../../core/highscore-categories.ts';
import MarkdownIt from 'markdown-it';
import {
  applyError,
  createGuildError,
  leaveError,
  manageMemberError,
  reviewError,
  updateGuildError,
  type GuildProfile,
} from '../../core/guild-checks.ts';
import type { Wire } from '../../core/actions.ts';
import type { Handler } from './actions.ts';
import type { Guild, GuildPlayer } from '../db/repos/guilds.ts';
import { fail, str, type Ctx } from './context.ts';
import { GUILDS_OFF } from './round.ts';
import { chatState } from './guild-chat.ts';
import { memberEvent, rankEvent } from './guild-events.ts';
import { recheckHolds } from './holding.ts';
import {
  actor,
  asRule,
  GUILD_ERROR,
  memberOf,
  placeOf,
  rankId,
  rankState,
  refuse,
  type Actor,
} from './guild-ranks.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { StateShape } from '../../core/state/guilds.ts';

const markdown = new MarkdownIt({ html: false, linkify: false }).disable(
  'image',
);

const JOINED = 'Du hast bereits eine Gilde oder eine offene Bewerbung.';
const NO_GUILD = 'Diese Gilde gibt es nicht.';

/** The refusals of a guild profile (#68), by the codes of `profileError` (#214). */
const PROFILE_ERROR = {
  tag: 'Das Kürzel braucht 2 bis 8 Buchstaben oder Ziffern.',
  name: 'Der Gildenname braucht 3 bis 32 Zeichen.',
  text: 'Der Gildentext darf höchstens 6.000 Zeichen haben.',
  taken: 'Das Kürzel oder der Name ist schon vergeben.',
};

/** The profile as sent: the tag in upper case, all trimmed. */
function profile(d: Wire<'createGuild' | 'updateGuild'>): GuildProfile {
  return {
    tag: str(d.tag, 30).toUpperCase(),
    name: str(d.name, 100),
    description: String(d.description ?? '').trim(),
  };
}

/** Whether a guild other than `except` has the tag or the name. */
const taken = (ctx: Ctx, p: GuildProfile, except = ''): boolean =>
  ctx.guilds.taken(except, p.tag, p.name);

/** Whether the player is in a guild or has an open application. */
const joined = (ctx: Ctx, uid: string): boolean => !!ctx.guilds.membership(uid);

const createGuild: Handler<'createGuild'> = (ctx, user, d) => {
  const p = profile(d);
  refuse(createGuildError(joined(ctx, user.id), p, taken(ctx, p)), {
    member: JOINED,
    ...PROFILE_ERROR,
  });
  const id = ctx.id();
  ctx.guilds.create(id, p.tag, p.name, p.description, user.id);
  return 'Gilde gegründet.';
};

const updateGuild: Handler<'updateGuild'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const p = profile(d);
  refuse(updateGuildError(asRule(a), p, taken(ctx, p, a.guild.id)), {
    right: GUILD_ERROR.right,
    ...PROFILE_ERROR,
  });
  ctx.guilds.update(a.guild.id, p.tag, p.name, p.description);
  return 'Gildenprofil gespeichert.';
};

const applyToGuild: Handler<'applyToGuild'> = (ctx, user, d) => {
  const target = ctx.guilds.get(str(d.id, 32));
  refuse(applyError(joined(ctx, user.id), !!target), {
    member: JOINED,
    guild: NO_GUILD,
  });
  ctx.guilds.apply(user.id, target!.id);
  return 'Bewerbung gesendet.';
};

const reviewGuildApplication: Handler<'reviewGuildApplication'> = (
  ctx,
  user,
  d,
) => {
  const a = actor(ctx, user.id);
  const applicant = ctx.guilds.membership(str(d.uid, 40));
  const open =
    applicant?.guild_id === a.guild.id && applicant.status === 'pending';
  refuse(reviewError(asRule(a), open), {
    right: GUILD_ERROR.right,
    application: 'Diese Bewerbung gibt es nicht.',
  });
  const uid = applicant!.user_id;
  if (d.accept === true) {
    ctx.guilds.accept(uid);
    memberEvent(ctx, a.guild.id, 'join', uid, user.id);
    return 'Bewerbung angenommen.';
  }
  ctx.guilds.removeMember(uid);
  return 'Bewerbung abgelehnt.';
};

const leaveGuild: Handler<'leaveGuild'> = (ctx, user) => {
  const member = ctx.guilds.membership(user.id);
  const own = member && (ctx.guilds.get(member.guild_id) ?? fail(NO_GUILD));
  const lead = own?.founder === user.id;
  const others = lead && ctx.guilds.hasOtherMembers(own!.id, user.id);
  refuse(leaveError(!!member, lead, others), {
    none: 'Du bist in keiner Gilde.',
    handover: 'Übergib zuerst die Gildenleitung.',
  });
  if (lead) {
    ctx.guilds.delete(own!.id);
    recheckHolds(ctx);
    return 'Gilde aufgelöst.';
  }
  ctx.guilds.removeMember(user.id);
  // A bond that ends may end a hold too (#440, 229a).
  recheckHolds(ctx);
  if (member!.status === 'pending') return 'Bewerbung zurückgezogen.';
  memberEvent(ctx, own!.id, 'leave', user.id);
  return 'Gilde verlassen.';
};

const manageGuildMember: Handler<'manageGuildMember'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const target = memberOf(ctx, a, d.uid);
  const transfer = d.transfer === true;
  const rank = rankId(d.rank);
  const error = manageMemberError(
    asRule(a),
    target && { place: placeOf(a, target), self: target.user_id === user.id },
    transfer ? { ranks: a.ranks, rank } : null,
  );
  refuse(error, {
    ...GUILD_ERROR,
    leitung: 'Wähle für dich einen Rang unter der Leitung.',
  });
  const uid = target!.user_id;
  if (transfer) {
    const own = a.ranks.find((r) => r.id === rank)!;
    ctx.guilds.transfer(a.guild.id, uid, own.id);
    // Two new ranks (owner, 2026-11-15): the new Leitung and the old one.
    rankEvent(ctx, a.guild.id, uid, a.ranks[0]!.name, user.id);
    rankEvent(ctx, a.guild.id, user.id, own.name, user.id);
    return 'Gildenleitung übergeben.';
  }
  ctx.guilds.removeMember(uid);
  recheckHolds(ctx);
  memberEvent(ctx, a.guild.id, 'remove', uid, user.id);
  return 'Mitglied entfernt.';
};

function publicGuild(
  g: Guild,
  players: GuildPlayer[],
  points: Record<string, number> | null,
): PublicGuild {
  const base = {
    id: g.id,
    tag: g.tag,
    name: g.name,
    html: markdown.render(g.description),
  };
  const inGuild = players.filter(
    (p) => p.guild_id === g.id && p.status === 'member',
  );
  // While the highscore shows nothing, no points of a member and no sum of
  // them (#422, 182a): the members by name.
  if (!points)
    return {
      ...base,
      members: inGuild
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  const members = inGuild
    .map((p) => ({ id: p.id, name: p.name, points: points[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const score = members.reduce((sum, member) => sum + member.points, 0);
  return {
    ...base,
    members,
    score,
    average: members.length ? Math.floor(score / members.length) : 0,
  };
}

/** The profile text and, for a rank with the right, the open applications. */
function management(a: Actor, players: GuildPlayer[]) {
  return {
    id: a.guild.id,
    description: a.guild.description,
    pending: a.rights.has('applications')
      ? players
          .filter((p) => p.guild_id === a.guild.id && p.status === 'pending')
          .map((p) => ({ id: p.id, name: p.name }))
      : [],
  };
}

export function guildState(
  ctx: Ctx,
  uid: string,
  points: Record<string, number> | null,
) {
  const all = ctx.guilds.all();
  const players = ctx.guilds.players();
  const own = players.find((p) => p.id === uid);
  const inside = own?.status === 'member' ? actor(ctx, uid) : null;
  return {
    directory: all
      .map((g) => publicGuild(g, players, points))
      .sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.tag.localeCompare(b.tag),
      ),
    own: own ? { id: own.guild_id, status: own.status } : null,
    management: inside ? management(inside, players) : null,
    ranks: inside ? rankState(inside, players) : null,
    // The chat of the own guild (#169); none without a chat right.
    chat: inside ? chatState(ctx, inside, players) : null,
  };
}

export const serverFeature = {
  // Guilds, with their chat and ranks, are one switch of the round (#191, #374).
  enabled: (round) => round.guilds,
  off: GUILDS_OFF,
  actions: {
    createGuild,
    updateGuild,
    applyToGuild,
    reviewGuildApplication,
    leaveGuild,
    manageGuildMember,
  },
  state: {
    order: 110,
    keys: ['guilds'],
    // No guild data while guilds are off: `enabled` above (#191, #374).
    // No points of the members while the highscore shows nothing (182a).
    build: (ctx, u, view) => ({
      guilds: guildState(
        ctx,
        u.id,
        highscoreShows(view.round) === SHOWS.none ? null : view.pts,
      ),
    }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
