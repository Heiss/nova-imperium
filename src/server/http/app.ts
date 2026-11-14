// The HTTP interface: a JSON API under /api, the client files, /healthz.
import { randomUUID } from 'node:crypto';
import { activity, audited, record, type AuditEntry } from '../audit.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as auth from '../auth.ts';
import * as security from '../account-security.ts';
import * as passkeys from '../passkeys.ts';
import type { Config } from '../config.ts';
import { deleteAccount } from '../delete-account.ts';
import { noteServerError } from '../error-log.ts';
import { isDatabaseBusy } from '../db/database.ts';
import type { User } from '../db/repos/players.ts';
import { requireAdmin } from '../game/admin.ts';
import { type Ctx, GameError, str } from '../game/context.ts';
import { ACTIONS, runAction } from '../game/dispatch.ts';
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
import { adminRoutes } from './admin.ts';
import { errorRoutes } from './errors.ts';
import { loadStatic } from './static.ts';
import type { News } from '../news.ts';

export interface AppDeps {
  ctx: Ctx;
  cfg: Config;
  mailer: Mailer | null;
  publicDir: string;
  log?: (msg: string, e?: unknown) => void;
  /** „Neuigkeiten“ from CHANGELOG.md (news.ts). */
  news?: News;
}

export const COOKIE = 'nova_session';

export interface Call {
  requestId: string;
  req: IncomingMessage;
  res: ServerResponse;
  body: Record<string, unknown>;
  token: string | undefined;
}

type Reply = {
  status?: number;
  json?: unknown;
  cookie?: string;
  /** A download instead of JSON (the ZIP of the admin tab „Fehler“). */
  file?: { type: string; name: string; body: Uint8Array };
};
/** Refuses a request that exceeds the rate limit. */
type Guard = (req: IncomingMessage) => void;
/** Starts a session for a signed-in user. */
type Enter = (u: User, remember?: boolean) => Reply;
export type Handler = (call: Call) => Reply | Promise<Reply>;

function send(
  res: ServerResponse,
  status: number,
  type: string,
  body: string | Uint8Array,
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

export function sessionCookie(
  cfg: Config,
  token: string | null,
  remember = true,
): string {
  const secure = cfg.secureCookies ? '; Secure' : '';
  const life = token ? cfg.sessionDays * 86400 : 0;
  const age = token && !remember ? '' : `; Max-Age=${life}`;
  return `${COOKIE}=${token ?? ''}; HttpOnly; Path=/; SameSite=Lax${age}${secure}`;
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

function passwordRoutes(d: AppDeps, guard: Guard): Record<string, Handler> {
  const { ctx, cfg } = d;
  const minimum = cfg.passwordMinLength;
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
        void sendReset(d, body.email).catch((error: unknown) => {
          d.log?.('Password reset mail failed');
          noteServerError(
            ctx,
            { action: 'mail', error, version: d.news?.version },
            d.log,
          );
        });
      });
      return { json: { ok: true } };
    },
    'POST /api/password/reset': ({ req, body }) => {
      guard(req);
      security.resetPassword(ctx, body.token, body.password, minimum);
      return signedOut();
    },
    'POST /api/password/change': (call) => {
      guard(call.req);
      const user = sessionUserOf(ctx, call);
      const { password, confirmation, current } = call.body;
      if (password !== confirmation)
        throw new GameError('Die neuen Passwörter stimmen nicht überein.');
      security.changePassword(ctx, user, current, password, minimum);
      return signedOut();
    },
    'POST /api/account/delete': (call) => {
      guard(call.req);
      deleteAccount(ctx, sessionUserOf(ctx, call), call.body.password);
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
  const enter = (u: User, remember = true): Reply => ({
    json: { ok: true, state: stateFor(ctx, u) },
    cookie: sessionCookie(cfg, auth.startSession(ctx, cfg, u.id), remember),
  });
  return {
    // Whether Web Push is on decides if the options show the push kinds (#192).
    'GET /api/account/policy': () => ({
      json: { passwordMinLength: cfg.passwordMinLength, webPush: cfg.webPush },
    }),
    'GET /healthz': () => {
      ctx.db.prepare('SELECT 1').get();
      return { json: { ok: true } };
    },
    'POST /api/invite/check': ({ req, body }) => {
      guard(req);
      const email = auth.openInvitation(ctx, body.token).email;
      return { json: { email, galaxies: ctx.admin.universe().galaxies } };
    },
    ...loginRoutes(d, guard, enter),
    ...passwordRoutes(d, guard),
    ...passkeyRoutes(d, guard, enter),
    'POST /api/logout': (call) => logoutReply(ctx, cfg, call),
  };
}

function passkeyRoutes(
  d: AppDeps,
  guard: Guard,
  enter: Enter,
): Record<string, Handler> {
  const { ctx, cfg } = d;
  return {
    'POST /api/passkeys/list': (call) => ({
      json: { keys: passkeys.passkeysOf(ctx, sessionUserOf(ctx, call)) },
    }),
    'POST /api/passkeys/register/options': async (call) => {
      guard(call.req);
      const user = sessionUserOf(ctx, call);
      const options = passkeys.registerPasskeyOptions(
        ctx,
        cfg,
        user,
        call.token!,
        call.body.password,
      );
      return { json: await options };
    },
    'POST /api/passkeys/register': async (call) => {
      guard(call.req);
      const user = sessionUserOf(ctx, call);
      await passkeys.registerPasskey(ctx, cfg, user, call.token!, call.body);
      return { json: { ok: true } };
    },
    'POST /api/passkeys/remove': (call) => {
      const user = sessionUserOf(ctx, call);
      passkeys.removePasskey(ctx, user, call.body.id);
      return { json: { ok: true } };
    },
    'POST /api/passkeys/login/options': async ({ req }) => {
      guard(req);
      return { json: await passkeys.passkeyLoginOptions(ctx, cfg) };
    },
    'POST /api/passkeys/login': async ({ req, body, requestId }) => {
      guard(req);
      const user = await passkeys.verifyPasskeyLogin(ctx, cfg, body);
      return finishPasskeyLogin(
        ctx,
        user,
        requestId,
        body.remember === true,
        enter,
      );
    },
  };
}

function finishPasskeyLogin(
  ctx: Ctx,
  user: User,
  requestId: string,
  remember: boolean,
  enter: Enter,
): Reply {
  return audited(
    ctx,
    { category: 'account', action: 'loginPasskey', actor: user.id, requestId },
    () => enter(user, remember),
  );
}

function loginRoutes(
  d: AppDeps,
  guard: Guard,
  enter: Enter,
): Record<string, Handler> {
  const { ctx, cfg } = d;
  return {
    'POST /api/register': ({ req, body, requestId }) => {
      guard(req);
      const registration = body as unknown as auth.Registration;
      const user = ctx.tx(() => {
        const u = auth.register(ctx, registration, cfg.passwordMinLength);
        record(ctx, {
          category: 'account',
          action: 'register',
          actor: u.id,
          requestId,
        });
        return u;
      });
      return cfg.emailLoginCodes
        ? { json: { ok: true, loginRequired: true } }
        : enter(user);
    },
    'POST /api/login': ({ req, body, requestId }) => {
      guard(req);
      const actor = ctx.players.byName(str(body.name, 20))?.id;
      const action = cfg.emailLoginCodes ? 'loginPassword' : 'login';
      const user = audited(
        ctx,
        { category: 'account', action, actor, requestId },
        () => auth.login(ctx, body.name, body.password),
      );
      return cfg.emailLoginCodes
        ? beginLogin(d, user)
        : enter(user, body.remember !== false);
    },
    'POST /api/login/code': ({ req, body, requestId }) => {
      guard(req);
      if (!cfg.emailLoginCodes)
        throw new GameError('Anmeldecodes sind nicht aktiviert.');
      return loginCodeReply(ctx, body, requestId, enter);
    },
  };
}

function logoutReply(ctx: Ctx, cfg: Config, { token, requestId }: Call): Reply {
  const u = auth.sessionUser(ctx, token);
  if (u)
    audited(
      ctx,
      { category: 'account', action: 'logout', actor: u.id, requestId },
      () => auth.endSession(ctx, token),
    );
  return { json: { ok: true }, cookie: sessionCookie(cfg, null) };
}

function loginCodeReply(
  ctx: Ctx,
  body: Call['body'],
  requestId: string,
  enter: Enter,
): Reply {
  const entry: AuditEntry = {
    category: 'account',
    action: 'loginCode',
    requestId,
  };
  // Failed code checks increment the attempt counter. Keep that write even
  // when verification throws, outside the session-and-audit transaction.
  let user: User;
  try {
    user = security.completeLogin(ctx, body.challenge, body.code);
  } catch (error) {
    record(ctx, entry, error instanceof GameError ? 'rejected' : 'error');
    throw error;
  }
  entry.actor = user.id;
  return audited(ctx, entry, () => enter(user, body.remember !== false));
}

function pushRoutes(d: AppDeps): Record<string, Handler> {
  const user = (call: Call): User => {
    const u = sessionUserOf(d.ctx, call);
    if (!d.cfg.webPush)
      throw new GameError(
        'Browser-Benachrichtigungen sind auf diesem Server deaktiviert. Die Serverkonfiguration benötigt NOVA_WEB_PUSH=1 und eine HTTPS-Adresse.',
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

const DATABASE_BUSY =
  'Die Datenbank ist gerade beschäftigt. Bitte versuche es gleich noch einmal.';

function actionReply(ctx: Ctx, u: User, call: Call): Reply {
  let msg: string | null;
  try {
    msg = playerAction(ctx, u, call);
  } catch (error) {
    if (!isDatabaseBusy(error)) throw error;
    // The audited action did not commit. Only this response permits an automatic retry.
    return {
      status: 503,
      json: { error: DATABASE_BUSY, code: 'ACTION_DB_BUSY' },
    };
  }
  return {
    json: {
      ok: true,
      msg,
      state: stateFor(ctx, ctx.players.get(u.id)!, call.body.planet),
    },
  };
}

/** The game and the admin functions; all need a session. */
function gameRoutes(d: AppDeps): Record<string, Handler> {
  const { ctx } = d;
  return {
    'GET /api/state': (call) => ({
      json: stateFor(
        ctx,
        sessionUserOf(ctx, call),
        new URL(call.req.url ?? '/', 'http://localhost').searchParams.get(
          'planet',
        ),
      ),
    }),
    'GET /api/news': (call) => {
      sessionUserOf(ctx, call);
      return { json: d.news ?? { version: null, versions: [] } };
    },
    'POST /api/activity': (call) => {
      activity(ctx, sessionUserOf(ctx, call));
      return { json: { ok: true } };
    },
    'POST /api/action': (call) =>
      actionReply(ctx, sessionUserOf(ctx, call), call),
    ...adminRoutes(
      d,
      (call) => sessionUserOf(ctx, call),
      (call, u) => invite(d, u, call.body.email, call.requestId),
    ),
  };
}

function playerAction(ctx: Ctx, u: User, call: Call): string | null {
  const name = String(call.body.type);
  const action = Object.hasOwn(ACTIONS, name) ? name : 'unknown';
  const category =
    action === 'settings' || action === 'reset' ? 'admin.write' : 'game';
  const entry: AuditEntry = {
    category,
    action,
    actor: u.id,
    requestId: call.requestId,
  };
  return audited(ctx, entry, () => {
    if (category === 'game') {
      const id = call.body.planet;
      const selected = typeof id === 'string' ? ctx.planets.get(id) : null;
      entry.detail = {
        planet:
          selected?.owner === u.id ? selected.id : ctx.planets.home(u.id)?.id,
      };
    }
    const before =
      action === 'settings' && u.admin ? ctx.admin.universe() : null;
    const msg = runAction(ctx, u.id, call.body, entry);
    if (before) entry.detail = { before, after: ctx.admin.universe() };
    return msg;
  });
}

/** Creates the invitation, then tries the mail. The link is always returned for copying. */
async function invite(
  d: AppDeps,
  u: User,
  email: unknown,
  requestId?: string,
): Promise<Reply> {
  requireAdmin(u);
  const entry = {
    category: 'admin.write',
    action: 'invite',
    actor: u.id,
    requestId,
    detail: {},
  } as const;
  const { invitation, link } = audited(d.ctx, entry, () => {
    const created = auth.createInvitation(d.ctx, d.cfg, u.id, email);
    Object.assign(entry.detail, { invitation: created.invitation.id });
    return created;
  });
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
  requestId: string,
): Promise<void> {
  const route = `${req.method} ${path}`;
  const handler = table.find(([registered]) => registered === route)?.[1];
  if (!handler) return json(res, 404, { error: 'Nicht gefunden.' });
  if (crossSite(req, d.cfg))
    return json(res, 403, { error: 'Anfrage abgelehnt.' });
  const body = req.method === 'POST' ? await readJson(req) : {};
  const reply = await handler({
    requestId,
    req,
    res,
    body,
    token: cookies(req.headers.cookie).get(COOKIE),
  });
  if (reply.file)
    return send(res, 200, reply.file.type, reply.file.body, {
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename="${reply.file.name}"`,
    });
  json(res, reply.status ?? 200, reply.json, reply.cookie);
}

function fault(
  d: AppDeps,
  req: IncomingMessage,
  res: ServerResponse,
  e: unknown,
  { requestId, path }: { requestId: string; path: string },
): void {
  if (e instanceof GameError) return json(res, 400, { error: e.message });
  if (e instanceof Unauthorized)
    return json(res, 401, { error: 'Bitte einloggen.' });
  if (isDatabaseBusy(e)) return json(res, 503, { error: DATABASE_BUSY });
  d.log?.(`Request failed [${requestId}]`, e);
  recordFault(d, req, e, { requestId, path });
  json(res, 500, { error: 'Serverfehler.' });
}

/** An unexpected error of a request goes into the error log (issue #126). */
function recordFault(
  d: AppDeps,
  req: IncomingMessage,
  error: unknown,
  { requestId, path }: { requestId: string; path: string },
): void {
  let user: User | null = null;
  try {
    user = auth.sessionUser(d.ctx, cookies(req.headers.cookie).get(COOKIE));
  } catch {
    // Without a working database the error is recorded without a player.
  }
  noteServerError(
    d.ctx,
    {
      action: `${req.method} ${path}`,
      error,
      requestId,
      player: user?.id ?? null,
      version: d.news?.version,
    },
    d.log,
  );
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
  const errors = errorRoutes(d, (call) => sessionUserOf(d.ctx, call));
  const table = Object.entries({
    ...accountRoutes(d, limiter),
    ...gameRoutes(d),
    ...pushRoutes(d),
    ...errors.routes,
  });
  const handle = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    const path = (req.url ?? '/').split('?')[0]!;
    const requestId = randomUUID();
    try {
      if (path.startsWith('/api/') || path === '/healthz') {
        res.setHeader('x-request-id', requestId);
        return await handleApi(table, d, req, res, path, requestId);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return json(res, 405, { error: 'Nicht erlaubt.' });
      const file = await loadStatic(d.publicDir, path);
      send(res, file.status, file.type, file.body, {
        'cache-control': 'no-cache',
      });
    } catch (e) {
      fault(d, req, res, e, { requestId, path });
    }
  };
  return {
    handle,
    sweep: () => {
      limiter.sweep();
      errors.sweep();
      security.purgeAccountTokens(d.ctx);
      passkeys.purgePasskeyChallenges(d.ctx);
    },
  };
}
