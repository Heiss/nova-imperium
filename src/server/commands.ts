// Commands for the operator (docker compose exec app nova …). Making someone
// admin is only possible here, never through the web.
import { audited } from './audit.ts';
import { createInvitation } from './auth.ts';
import type { Config } from './config.ts';
import type { Ctx } from './game/context.ts';
import { invitationMail, type Mailer } from './mail.ts';

export const USAGE = `Usage: nova <command>
  admin <name>      make the player <name> admin
  unadmin <name>    take the admin rights of <name>
  admins            list the admins
  invite <email>    create an invitation (prints the link, sends a mail if SMTP is set)
  maintenance on|off|status
                    keep players out with „Wartung“ (works without the database)`;

export interface Output {
  out: (line: string) => void;
  err: (line: string) => void;
}

function setAdmin(
  ctx: Ctx,
  name: string | undefined,
  admin: boolean,
  o: Output,
): number {
  const u = name ? ctx.players.byName(name) : null;
  if (!u) {
    o.err(`No player named "${name ?? ''}".`);
    return 1;
  }
  audited(
    ctx,
    {
      category: 'admin.write',
      action: admin ? 'grantAdmin' : 'revokeAdmin',
      target: u.id,
      detail: { source: 'operator', before: u.admin, after: admin },
    },
    () => {
      u.admin = admin;
      ctx.players.save(u);
    },
  );
  o.out(`${u.name} is ${admin ? 'now' : 'no longer'} admin.`);
  return 0;
}

async function invite(
  ctx: Ctx,
  cfg: Config,
  mailer: Mailer | null,
  email: string | undefined,
  o: Output,
): Promise<number> {
  const entry = {
    category: 'admin.write',
    action: 'invite',
    detail: { source: 'operator' },
  } as const;
  const { invitation, link } = audited(ctx, entry, () => {
    const created = createInvitation(ctx, cfg, null, email);
    Object.assign(entry.detail, { invitation: created.invitation.id });
    return created;
  });
  o.out(
    `Invitation for ${invitation.email}, valid until ${new Date(invitation.expires).toISOString()}:`,
  );
  o.out(link);
  if (!mailer) return 0;
  try {
    await mailer(
      invitationMail(invitation.email, link, invitation.expires, 'Der Admin'),
    );
    o.out('The invitation mail was sent.');
  } catch (e) {
    o.err(
      `The mail could not be sent (${(e as Error).message}); give the link yourself.`,
    );
  }
  return 0;
}

export async function runCommand(
  ctx: Ctx,
  cfg: Config,
  mailer: Mailer | null,
  args: string[],
  o: Output,
): Promise<number> {
  const [cmd, arg] = args;
  try {
    if (cmd === 'admin') return setAdmin(ctx, arg, true, o);
    if (cmd === 'unadmin') return setAdmin(ctx, arg, false, o);
    if (cmd === 'admins') {
      const list = audited(
        ctx,
        {
          category: 'admin.read',
          action: 'admins',
          detail: { source: 'operator' },
        },
        () => ctx.players.all().filter((u) => u.admin),
      );
      o.out(list.length ? list.map((u) => u.name).join('\n') : 'No admin yet.');
      return 0;
    }
    if (cmd === 'invite') return await invite(ctx, cfg, mailer, arg, o);
  } catch (e) {
    o.err((e as Error).message);
    return 1;
  }
  o.err(USAGE);
  return 2;
}
