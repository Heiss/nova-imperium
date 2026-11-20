import MarkdownIt from 'markdown-it';
import type { Wire } from '../../core/actions.ts';
import type { Handler } from './actions.ts';
import type { Guild, GuildPlayer } from '../db/repos/guilds.ts';
import { fail, str, type Ctx } from './context.ts';
import { chatState } from './guild-chat.ts';
import { memberEvent, rankEvent } from './guild-events.ts';
import {
  actor,
  below,
  handOverRank,
  memberOf,
  need,
  placeOf,
  rankState,
  type Actor,
} from './guild-ranks.ts';
import type { ServerFeature } from './feature.ts';

const markdown = new MarkdownIt({ html: false, linkify: false }).disable(
  'image',
);

function guild(ctx: Ctx, id: unknown): Guild {
  return ctx.guilds.get(str(id, 32)) ?? fail('Diese Gilde gibt es nicht.');
}

function profile(
  ctx: Ctx,
  d: Wire<'createGuild' | 'updateGuild'>,
  except = '',
) {
  const tag = str(d.tag, 30).toUpperCase();
  const name = str(d.name, 100);
  const description = String(d.description ?? '').trim();
  if (!/^[A-Z0-9]{2,8}$/.test(tag))
    fail('Das Kürzel braucht 2 bis 8 Buchstaben oder Ziffern.');
  if (name.length < 3 || name.length > 32)
    fail('Der Gildenname braucht 3 bis 32 Zeichen.');
  if (description.length > 6000)
    fail('Der Gildentext darf höchstens 6.000 Zeichen haben.');
  if (ctx.guilds.taken(except, tag, name))
    fail('Das Kürzel oder der Name ist schon vergeben.');
  return { tag, name, description };
}

const createGuild: Handler<'createGuild'> = (ctx, user, d) => {
  if (ctx.guilds.membership(user.id))
    fail('Du hast bereits eine Gilde oder eine offene Bewerbung.');
  const { tag, name, description } = profile(ctx, d);
  const id = ctx.id();
  ctx.guilds.create(id, tag, name, description, user.id);
  return 'Gilde gegründet.';
};

const updateGuild: Handler<'updateGuild'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'profile');
  const { tag, name, description } = profile(ctx, d, a.guild.id);
  ctx.guilds.update(a.guild.id, tag, name, description);
  return 'Gildenprofil gespeichert.';
};

const applyToGuild: Handler<'applyToGuild'> = (ctx, user, d) => {
  if (ctx.guilds.membership(user.id))
    fail('Du hast bereits eine Gilde oder eine offene Bewerbung.');
  const target = guild(ctx, d.id);
  ctx.guilds.apply(user.id, target.id);
  return 'Bewerbung gesendet.';
};

const reviewGuildApplication: Handler<'reviewGuildApplication'> = (
  ctx,
  user,
  d,
) => {
  const a = actor(ctx, user.id);
  need(a, 'applications');
  const applicant = ctx.guilds.membership(str(d.uid, 40));
  if (applicant?.guild_id !== a.guild.id || applicant.status !== 'pending')
    return fail('Diese Bewerbung gibt es nicht.');
  if (d.accept === true) {
    ctx.guilds.accept(applicant.user_id);
    memberEvent(ctx, a.guild.id, 'join', applicant.user_id, user.id);
    return 'Bewerbung angenommen.';
  }
  ctx.guilds.removeMember(applicant.user_id);
  return 'Bewerbung abgelehnt.';
};

const leaveGuild: Handler<'leaveGuild'> = (ctx, user) => {
  const member =
    ctx.guilds.membership(user.id) ?? fail('Du bist in keiner Gilde.');
  const own = guild(ctx, member.guild_id);
  if (own.founder === user.id) {
    if (ctx.guilds.hasOtherMembers(own.id, user.id))
      fail('Übergib zuerst die Gildenleitung.');
    ctx.guilds.delete(own.id);
    return 'Gilde aufgelöst.';
  }
  ctx.guilds.removeMember(user.id);
  if (member.status === 'pending') return 'Bewerbung zurückgezogen.';
  memberEvent(ctx, own.id, 'leave', user.id);
  return 'Gilde verlassen.';
};

const manageGuildMember: Handler<'manageGuildMember'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const target = memberOf(ctx, a, d.uid);
  if (target.user_id === user.id)
    return fail('Dieses Gildenmitglied gibt es nicht.');
  if (d.transfer === true) {
    const own = handOverRank(a, d.rank);
    ctx.guilds.transfer(a.guild.id, target.user_id, own.id);
    // Two new ranks (owner, 2026-11-15): the new Leitung and the old one.
    rankEvent(ctx, a.guild.id, target.user_id, a.ranks[0]!.name, user.id);
    rankEvent(ctx, a.guild.id, user.id, own.name, user.id);
    return 'Gildenleitung übergeben.';
  }
  need(a, 'remove');
  below(a, placeOf(a, target));
  ctx.guilds.removeMember(target.user_id);
  memberEvent(ctx, a.guild.id, 'remove', target.user_id, user.id);
  return 'Mitglied entfernt.';
};

function publicGuild(
  g: Guild,
  players: GuildPlayer[],
  points: Record<string, number>,
) {
  const members = players
    .filter((p) => p.guild_id === g.id && p.status === 'member')
    .map((p) => ({ id: p.id, name: p.name, points: points[p.id] ?? 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const score = members.reduce((sum, member) => sum + member.points, 0);
  return {
    id: g.id,
    tag: g.tag,
    name: g.name,
    html: markdown.render(g.description),
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
  points: Record<string, number>,
) {
  const all = ctx.guilds.all();
  const players = ctx.guilds.players();
  const own = players.find((p) => p.id === uid);
  const inside = own?.status === 'member' ? actor(ctx, uid) : null;
  return {
    directory: all
      .map((g) => publicGuild(g, players, points))
      .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag)),
    own: own ? { id: own.guild_id, status: own.status } : null,
    management: inside ? management(inside, players) : null,
    ranks: inside ? rankState(inside, players) : null,
    // The chat of the own guild (#169); none without a chat right.
    chat: inside ? chatState(ctx, inside, players) : null,
  };
}

export const serverFeature = {
  guildActions: {
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
    // No guild data while guilds are off in the round (#191).
    build: (ctx, u, view) => ({
      guilds: view.round.guilds ? guildState(ctx, u.id, view.pts) : null,
    }),
  },
} satisfies ServerFeature;
