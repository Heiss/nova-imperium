// Commands for the operator (docker compose exec app nova …). Making someone
// admin is only possible here, never through the web.
import { createInvitation } from './auth.ts';
import type { Config } from './config.ts';
import type { Ctx } from './game/context.ts';
import { invitationMail, type Mailer } from './mail.ts';

export const USAGE = `Usage: nova <command>
  admin <name>      make the player <name> admin
  unadmin <name>    take the admin rights of <name>
  admins            list the admins
  invite <email>    create an invitation (prints the link, sends a mail if SMTP is set)`;

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
  const u = name ? ctx.store.userByName(name) : null;
  if (!u) {
    o.err(`No player named "${name ?? ''}".`);
    return 1;
  }
  u.admin = admin;
  ctx.store.saveUser(u);
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
  const { invitation, link } = ctx.store.tx(() =>
    createInvitation(ctx, cfg, null, email),
  );
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
      const list = ctx.store.users().filter((u) => u.admin);
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
