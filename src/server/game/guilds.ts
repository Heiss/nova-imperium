import MarkdownIt from 'markdown-it';
import type { Action } from './actions.ts';
import type { Guild, GuildPlayer } from '../db/repos/guilds.ts';
import { fail, str, type Ctx } from './context.ts';

const markdown = new MarkdownIt({ html: false, linkify: false }).disable(
  'image',
);

function guild(ctx: Ctx, id: unknown): Guild {
  return ctx.guilds.get(str(id, 32)) ?? fail('Diese Gilde gibt es nicht.');
}

function leadGuild(ctx: Ctx, uid: string): Guild {
  const member = ctx.guilds.membership(uid) ?? fail('Du bist in keiner Gilde.');
  const own = guild(ctx, member.guild_id);
  if (own.founder !== uid) return fail('Das darf nur die Gildenleitung.');
  return own;
}

function profile(ctx: Ctx, d: Record<string, unknown>, except = '') {
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

export const createGuild: Action = (ctx, user, d) => {
  if (ctx.guilds.membership(user.id))
    fail('Du hast bereits eine Gilde oder eine offene Bewerbung.');
  const { tag, name, description } = profile(ctx, d);
  const id = ctx.id();
  ctx.guilds.create(id, tag, name, description, user.id);
  return 'Gilde gegründet.';
};

export const updateGuild: Action = (ctx, user, d) => {
  const own = leadGuild(ctx, user.id);
  const { tag, name, description } = profile(ctx, d, own.id);
  ctx.guilds.update(own.id, tag, name, description);
  return 'Gildenprofil gespeichert.';
};

export const applyToGuild: Action = (ctx, user, d) => {
  if (ctx.guilds.membership(user.id))
    fail('Du hast bereits eine Gilde oder eine offene Bewerbung.');
  const target = guild(ctx, d.id);
  ctx.guilds.apply(user.id, target.id);
  return 'Bewerbung gesendet.';
};

export const reviewGuildApplication: Action = (ctx, user, d) => {
  const own = leadGuild(ctx, user.id);
  const applicant = ctx.guilds.membership(str(d.uid, 40));
  if (
    !applicant ||
    applicant.guild_id !== own.id ||
    applicant.status !== 'pending'
  )
    return fail('Diese Bewerbung gibt es nicht.');
  if (d.accept === true) {
    ctx.guilds.accept(applicant.user_id);
    return 'Bewerbung angenommen.';
  }
  ctx.guilds.removeMember(applicant.user_id);
  return 'Bewerbung abgelehnt.';
};

export const leaveGuild: Action = (ctx, user) => {
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
  return member.status === 'pending'
    ? 'Bewerbung zurückgezogen.'
    : 'Gilde verlassen.';
};

export const manageGuildMember: Action = (ctx, user, d) => {
  const own = leadGuild(ctx, user.id);
  const target = ctx.guilds.membership(str(d.uid, 40));
  if (
    !target ||
    target.guild_id !== own.id ||
    target.status !== 'member' ||
    target.user_id === user.id
  )
    return fail('Dieses Gildenmitglied gibt es nicht.');
  if (d.transfer === true) {
    ctx.guilds.transfer(own.id, target.user_id);
    return 'Gildenleitung übergeben.';
  }
  ctx.guilds.removeMember(target.user_id);
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
    founder: g.founder,
    html: markdown.render(g.description),
    members,
    score,
    average: members.length ? Math.floor(score / members.length) : 0,
  };
}

export function guildState(
  ctx: Ctx,
  uid: string,
  points: Record<string, number>,
) {
  const all = ctx.guilds.all();
  const players = ctx.guilds.players();
  const leading = all.find((g) => g.founder === uid);
  const own = players.find((p) => p.id === uid);
  return {
    directory: all
      .map((g) => publicGuild(g, players, points))
      .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag)),
    own: own ? { id: own.guild_id, status: own.status } : null,
    management: leading
      ? {
          id: leading.id,
          description: leading.description,
          pending: players
            .filter((p) => p.guild_id === leading.id && p.status === 'pending')
            .map((p) => ({ id: p.id, name: p.name })),
        }
      : null,
  };
}
