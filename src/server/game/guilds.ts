import MarkdownIt from 'markdown-it';
import type { Action } from './actions.ts';
import { fail, str, type Ctx } from './context.ts';

const markdown = new MarkdownIt({ html: false, linkify: false }).disable(
  'image',
);

interface GuildRow {
  id: string;
  tag: string;
  name: string;
  description: string;
  founder: string;
}

interface Membership {
  user_id: string;
  guild_id: string;
  status: 'pending' | 'member';
}

function membership(ctx: Ctx, uid: string): Membership | undefined {
  return ctx.store.db
    .prepare('SELECT * FROM guild_members WHERE user_id = ?')
    .get(uid) as Membership | undefined;
}

function guild(ctx: Ctx, id: unknown): GuildRow {
  return (
    (ctx.store.db
      .prepare('SELECT * FROM guilds WHERE id = ?')
      .get(str(id, 32)) as GuildRow | undefined) ??
    fail('Diese Gilde gibt es nicht.')
  );
}

function leadGuild(ctx: Ctx, uid: string): GuildRow {
  const member = membership(ctx, uid) ?? fail('Du bist in keiner Gilde.');
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
  if (
    ctx.store.db
      .prepare('SELECT 1 FROM guilds WHERE id != ? AND (tag = ? OR name = ?)')
      .get(except, tag, name)
  )
    fail('Das Kürzel oder der Name ist schon vergeben.');
  return { tag, name, description };
}

export const createGuild: Action = (ctx, user, d) => {
  if (membership(ctx, user.id))
    fail('Du hast bereits eine Gilde oder eine offene Bewerbung.');
  const { tag, name, description } = profile(ctx, d);
  const id = ctx.id();
  ctx.store.db
    .prepare('INSERT INTO guilds VALUES (?, ?, ?, ?, ?)')
    .run(id, tag, name, description, user.id);
  ctx.store.db
    .prepare("INSERT INTO guild_members VALUES (?, ?, 'member')")
    .run(user.id, id);
  return 'Gilde gegründet.';
};

export const updateGuild: Action = (ctx, user, d) => {
  const own = leadGuild(ctx, user.id);
  const { tag, name, description } = profile(ctx, d, own.id);
  ctx.store.db
    .prepare(
      'UPDATE guilds SET tag = ?, name = ?, description = ? WHERE id = ?',
    )
    .run(tag, name, description, own.id);
  return 'Gildenprofil gespeichert.';
};

export const applyToGuild: Action = (ctx, user, d) => {
  if (membership(ctx, user.id))
    fail('Du hast bereits eine Gilde oder eine offene Bewerbung.');
  const target = guild(ctx, d.id);
  ctx.store.db
    .prepare("INSERT INTO guild_members VALUES (?, ?, 'pending')")
    .run(user.id, target.id);
  return 'Bewerbung gesendet.';
};

export const reviewGuildApplication: Action = (ctx, user, d) => {
  const own = leadGuild(ctx, user.id);
  const applicant = membership(ctx, str(d.uid, 40));
  if (
    !applicant ||
    applicant.guild_id !== own.id ||
    applicant.status !== 'pending'
  )
    return fail('Diese Bewerbung gibt es nicht.');
  if (d.accept === true) {
    ctx.store.db
      .prepare("UPDATE guild_members SET status = 'member' WHERE user_id = ?")
      .run(applicant.user_id);
    return 'Bewerbung angenommen.';
  }
  ctx.store.db
    .prepare('DELETE FROM guild_members WHERE user_id = ?')
    .run(applicant.user_id);
  return 'Bewerbung abgelehnt.';
};

export const leaveGuild: Action = (ctx, user) => {
  const member = membership(ctx, user.id) ?? fail('Du bist in keiner Gilde.');
  const own = guild(ctx, member.guild_id);
  if (own.founder === user.id) {
    const others = ctx.store.db
      .prepare(
        "SELECT 1 FROM guild_members WHERE guild_id = ? AND user_id != ? AND status = 'member'",
      )
      .get(own.id, user.id);
    if (others) fail('Übergib zuerst die Gildenleitung.');
    ctx.store.db.prepare('DELETE FROM guilds WHERE id = ?').run(own.id);
    return 'Gilde aufgelöst.';
  }
  ctx.store.db
    .prepare('DELETE FROM guild_members WHERE user_id = ?')
    .run(user.id);
  return member.status === 'pending'
    ? 'Bewerbung zurückgezogen.'
    : 'Gilde verlassen.';
};

export const manageGuildMember: Action = (ctx, user, d) => {
  const own = leadGuild(ctx, user.id);
  const target = membership(ctx, str(d.uid, 40));
  if (
    !target ||
    target.guild_id !== own.id ||
    target.status !== 'member' ||
    target.user_id === user.id
  )
    return fail('Dieses Gildenmitglied gibt es nicht.');
  if (d.transfer === true) {
    ctx.store.db
      .prepare('UPDATE guilds SET founder = ? WHERE id = ?')
      .run(target.user_id, own.id);
    return 'Gildenleitung übergeben.';
  }
  ctx.store.db
    .prepare('DELETE FROM guild_members WHERE user_id = ?')
    .run(target.user_id);
  return 'Mitglied entfernt.';
};

interface GuildPlayer {
  id: string;
  name: string;
  guild_id: string;
  status: 'member' | 'pending';
}

function publicGuild(
  g: GuildRow,
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
  const all = ctx.store.db.prepare('SELECT * FROM guilds').all() as GuildRow[];
  const players = ctx.store.db
    .prepare(
      'SELECT u.id, u.name, m.guild_id, m.status FROM guild_members m JOIN users u ON u.id = m.user_id',
    )
    .all() as GuildPlayer[];
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
