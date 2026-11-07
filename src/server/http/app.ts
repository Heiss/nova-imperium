// The HTTP interface: a JSON API under /api, the client files, /healthz.
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as auth from '../auth.ts';
import * as security from '../account-security.ts';
import type { Config } from '../config.ts';
import type { User } from '../db/store.ts';
import { requireAdmin } from '../game/admin.ts';
import { type Ctx, GameError } from '../game/context.ts';
import { runAction } from '../game/dispatch.ts';
import { stateFor } from '../game/state.ts';
import { type Mailer, invitationMail } from '../mail.ts';
import {
  deletePushSubscription,
  savePushSubscription,
  vapidKeys,
} from '../web-push.ts';
import { RateLimiter } from './rate-limit.ts';
import { clientIp, cookies, readJson } from './request.ts';
import { SECURITY_HEADERS } from './security.ts';
import { loadStatic } from './static.ts';

export interface AppDeps {
  ctx: Ctx;
  cfg: Config;
  mailer: Mailer | null;
  publicDir: string;
  log?: (msg: string, e?: unknown) => void;
}

export const COOKIE = 'nova_session';

interface Call {
  req: IncomingMessage;
  res: ServerResponse;
  body: Record<string, unknown>;
  token: string | undefined;
}

type Reply = { status?: number; json: unknown; cookie?: string };
type Handler = (call: Call) => Reply | Promise<Reply>;

function send(
  res: ServerResponse,
  status: number,
  type: string,
  body: string | Buffer,
  extra: Record<string, string> = {},
): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': type,
    ...extra,
  });
  res.end(body);
}

const json = (
  res: ServerResponse,
  status: number,
  value: unknown,
  cookie?: string,
): void =>
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(value), {
    'cache-control': 'no-store',
    ...(cookie ? { 'set-cookie': cookie } : {}),
  });

export function sessionCookie(cfg: Config, token: string | null): string {
  const secure = cfg.secureCookies ? '; Secure' : '';
  const life = token ? cfg.sessionDays * 86400 : 0;
  return `${COOKIE}=${token ?? ''}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${life}${secure}`;
}

/** Cross-site requests are refused: JSON only, and the Origin must be ours. */
export function crossSite(req: IncomingMessage, cfg: Config): boolean {
  if (req.method !== 'POST') return false;
  const type = String(req.headers['content-type'] ?? '');
  if (!type.toLowerCase().startsWith('application/json')) return true;
  const origin = req.headers.origin;
  return origin !== undefined && origin !== cfg.publicUrl;
}

class Unauthorized extends Error {}

function sessionUserOf(ctx: Ctx, call: Call): User {
  const u = auth.sessionUser(ctx, call.token);
  if (!u) throw new Unauthorized();
  return u;
}

async function beginLogin(d: AppDeps, u: User): Promise<Reply> {
  if (!d.mailer)
    throw new GameError('Anmeldecodes sind momentan nicht verfügbar.');
  if (!u.email)
    throw new GameError(
      'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.',
    );
  const { challenge, code } = security.issueLoginCode(d.ctx, u.id);
  try {
    await d.mailer({
      to: u.email,
      subject: 'Dein Anmeldecode für Nova Imperium',
      text: `Dein Anmeldecode lautet ${code}. Er gilt einmal und für zehn Minuten.`,
    });
  } catch {
    throw new GameError('Der Anmeldecode konnte nicht gesendet werden.');
  }
  return { json: { challenge } };
}

async function sendReset(d: AppDeps, email: unknown): Promise<void> {
  if (!d.mailer) return;
  const reset = security.issueReset(d.ctx, email);
  if (!reset) return;
  await d.mailer({
    to: reset.email,
    subject: 'Passwort für Nova Imperium zurücksetzen',
    text: `Neues Passwort festlegen: ${d.cfg.publicUrl}/#reset=${reset.token}\n\nDer Link gilt einmal und für 30 Minuten. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.`,
  });
}

function passwordRoutes(
  d: AppDeps,
  guard: (req: IncomingMessage) => void,
): Record<string, Handler> {
  const { ctx, cfg } = d;
  const signedOut = (): Reply => ({
    json: { ok: true },
    cookie: sessionCookie(cfg, null),
  });
  return {
    'POST /api/password/forgot': ({ req, body }) => {
      guard(req);
      if (!d.mailer)
        throw new GameError(
          'Passwort-Wiederherstellung per E-Mail ist nicht eingerichtet.',
        );
      setImmediate(() => {
        void sendReset(d, body.email).catch(() =>
          d.log?.('Password reset mail failed'),
        );
      });
      return { json: { ok: true } };
    },
    'POST /api/password/reset': ({ req, body }) => {
      guard(req);
      security.resetPassword(ctx, body.token, body.password);
      return signedOut();
    },
    'POST /api/password/change': (call) => {
      guard(call.req);
      security.changePassword(
        ctx,
        sessionUserOf(ctx, call),
        call.body.current,
        call.body.password,
      );
      return signedOut();
    },
  };
}

/** Health check, invitations, registration, login and logout. */
function accountRoutes(
  d: AppDeps,
  limiter: RateLimiter,
): Record<string, Handler> {
  const { ctx, cfg } = d;
  const guard = (req: IncomingMessage): void => {
    if (limiter.limited(clientIp(req, cfg.trustProxy)))
      throw new GameError('Zu viele Versuche – bitte später nochmal.');
  };
  const enter = (u: User): Reply => ({
    json: { ok: true, state: stateFor(ctx, u) },
    cookie: sessionCookie(cfg, auth.startSession(ctx, cfg, u.id)),
  });
  return {
    'GET /healthz': () => {
      ctx.store.db.prepare('SELECT 1').get();
      return { json: { ok: true } };
    },
    'POST /api/invite/check': ({ req, body }) => {
      guard(req);
      const email = auth.openInvitation(ctx, body.token).email;
      return { json: { email, galaxies: ctx.store.universe().galaxies } };
    },
    'POST /api/register': ({ req, body }) => {
      guard(req);
      const registration = body as unknown as auth.Registration;
      const user = ctx.store.tx(() => auth.register(ctx, registration));
      return cfg.emailLoginCodes
        ? { json: { ok: true, loginRequired: true } }
        : enter(user);
    },
    'POST /api/login': ({ req, body }) => {
      guard(req);
      const user = auth.login(ctx, body.name, body.password);
      return cfg.emailLoginCodes ? beginLogin(d, user) : enter(user);
    },
    'POST /api/login/code': ({ req, body }) => {
      guard(req);
      if (!cfg.emailLoginCodes)
        throw new GameError('Anmeldecodes sind nicht aktiviert.');
      return enter(security.completeLogin(ctx, body.challenge, body.code));
    },
    ...passwordRoutes(d, guard),
    'POST /api/logout': ({ token }) => {
      auth.endSession(ctx, token);
      return { json: { ok: true }, cookie: sessionCookie(cfg, null) };
    },
  };
}

function pushRoutes(d: AppDeps): Record<string, Handler> {
  const user = (call: Call): User => {
    const u = sessionUserOf(d.ctx, call);
    if (!d.cfg.webPush)
      throw new GameError(
        'Browser-Benachrichtigungen sind auf diesem Server deaktiviert.',
      );
    return u;
  };
  return {
    'GET /api/push/key': (call) => {
      user(call);
      return { json: { publicKey: vapidKeys(d.ctx).publicKey } };
    },
    'POST /api/push/subscribe': (call) => {
      savePushSubscription(d.ctx, user(call).id, call.body);
      return { json: { ok: true } };
    },
    'POST /api/push/unsubscribe': (call) => {
      deletePushSubscription(
        d.ctx,
        sessionUserOf(d.ctx, call).id,
        call.body.endpoint,
      );
      return { json: { ok: true } };
    },
  };
}

/** The game and the admin functions; all need a session. */
function gameRoutes(d: AppDeps): Record<string, Handler> {
  const { ctx } = d;
  return {
    'GET /api/state': (call) => ({
      json: stateFor(ctx, sessionUserOf(ctx, call)),
    }),
    'POST /api/action': (call) => {
      const u = sessionUserOf(ctx, call);
      const msg = runAction(ctx, u.id, call.body);
      return {
        json: { ok: true, msg, state: stateFor(ctx, ctx.store.user(u.id)!) },
      };
    },
    'POST /api/admin/invite': (call) =>
      invite(d, sessionUserOf(ctx, call), call.body.email),
    'POST /api/admin/revoke': (call) => {
      const u = sessionUserOf(ctx, call);
      requireAdmin(u);
      ctx.store.revokeInvitations(
        { id: String(call.body.id ?? '') },
        ctx.now(),
      );
      return {
        json: {
          ok: true,
          msg: 'Einladung widerrufen.',
          state: stateFor(ctx, u),
        },
      };
    },
  };
}

/** Creates the invitation, then tries the mail. The link is always returned for copying. */
export async function invite(
  d: AppDeps,
  u: User,
  email: unknown,
): Promise<Reply> {
  requireAdmin(u);
  const { invitation, link } = d.ctx.store.tx(() =>
    auth.createInvitation(d.ctx, d.cfg, u.id, email),
  );
  let mailed = false;
  let mailError: string | null = d.mailer
    ? null
    : 'Kein SMTP eingerichtet: bitte den Link selbst weitergeben.';
  if (d.mailer) {
    try {
      await d.mailer(
        invitationMail(invitation.email, link, invitation.expires, u.name),
      );
      mailed = true;
    } catch (e) {
      d.log?.('Invitation mail failed', e);
      mailError =
        'Die Mail konnte nicht gesendet werden: bitte den Link selbst weitergeben.';
    }
  }
  const msg = mailed ? `Einladung an ${invitation.email} gesendet.` : mailError;
  return { json: { ok: true, msg, link, mailed, state: stateFor(d.ctx, u) } };
}

async function handleApi(
  table: readonly [string, Handler][],
  d: AppDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const route = `${req.method} ${path}`;
  const handler = table.find(([registered]) => registered === route)?.[1];
  if (!handler) return json(res, 404, { error: 'Nicht gefunden.' });
  if (crossSite(req, d.cfg))
    return json(res, 403, { error: 'Anfrage abgelehnt.' });
  const body = req.method === 'POST' ? await readJson(req) : {};
  const reply = await handler({
    req,
    res,
    body,
    token: cookies(req.headers.cookie).get(COOKIE),
  });
  json(res, reply.status ?? 200, reply.json, reply.cookie);
}

function fault(res: ServerResponse, e: unknown, log: AppDeps['log']): void {
  if (e instanceof GameError) return json(res, 400, { error: e.message });
  if (e instanceof Unauthorized)
    return json(res, 401, { error: 'Bitte einloggen.' });
  log?.('Request failed', e);
  json(res, 500, { error: 'Serverfehler.' });
}

export function createApp(d: AppDeps): {
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  sweep: () => void;
} {
  const limiter = new RateLimiter(
    d.cfg.rateLimitAttempts,
    d.cfg.rateLimitMinutes * 60000,
    d.ctx.now,
  );
  const table = Object.entries({
    ...accountRoutes(d, limiter),
    ...gameRoutes(d),
    ...pushRoutes(d),
  });
  const handle = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    const path = (req.url ?? '/').split('?')[0]!;
    try {
      if (path.startsWith('/api/') || path === '/healthz')
        return await handleApi(table, d, req, res, path);
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return json(res, 405, { error: 'Nicht erlaubt.' });
      const file = await loadStatic(d.publicDir, path);
      send(res, file.status, file.type, file.body, {
        'cache-control': 'no-cache',
      });
    } catch (e) {
      fault(res, e, d.log);
    }
  };
  return {
    handle,
    sweep: () => {
      limiter.sweep();
      security.purgeAccountTokens(d.ctx);
    },
  };
}
