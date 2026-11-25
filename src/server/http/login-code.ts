// The second factor by mail (#401, owner, 2026-11-25): the code form comes at
// once and the mail goes in the background (101b), the mail carries the code
// and a link (95a, text 1), and the browser that began the sign-in keeps it
// in the HttpOnly cookie `nova_login` (129a): the typed code and the link
// both take the challenge from it, so the link signs in only that browser and
// a reload of the code step keeps the sign-in.
import * as security from '../account-security.ts';
import { record, audited, type AuditEntry } from '../audit.ts';
import type { Config } from '../config.ts';
import type { User } from '../db/repos/players.ts';
import { noteServerError } from '../error-log.ts';
import { GameError } from '../game/context.ts';
import type { AppDeps, Call, Enter, Guard, Handler, Reply } from './app.ts';
import { cookies } from './request.ts';

const LOGIN_COOKIE = 'nova_login';
/** The cookie lives as long as the code: ten minutes. */
const LOGIN_COOKIE_AGE = 600;

/** Text 2 of #401: the link opened in another browser. */
const OTHER_BROWSER =
  'Dieser Link gilt nur im Browser, in dem du die Anmeldung begonnen hast. Gib dort den Code aus der E-Mail ein.';
/** 130b: the link of an older sign-in in the same browser. */
const OLDER_LINK =
  'Dieser Link gehört zu einer älteren Anmeldung. Gib den Code aus der neuesten E-Mail ein.';

/** The sign-in of this browser: its challenge and the wish to stay signed in. */
interface SignIn {
  challenge: string;
  remember: boolean;
}

/**
 * The cookie of the sign-in under way, `challenge.1` or `challenge.0`: the
 * wish „angemeldet bleiben“ of the login form goes with it, so the link, which
 * opens a new tab, and a reload keep it. `null` clears the cookie.
 */
function loginCookie(cfg: Config, signIn: SignIn | null): string {
  const secure = cfg.secureCookies ? '; Secure' : '';
  const value = signIn ? `${signIn.challenge}.${signIn.remember ? 1 : 0}` : '';
  const age = signIn ? LOGIN_COOKIE_AGE : 0;
  return `${LOGIN_COOKIE}=${value}; HttpOnly; Path=/api/login; SameSite=Lax; Max-Age=${age}${secure}`;
}

function signInOf(call: Call): SignIn | undefined {
  const m = /^([\w-]+)\.([01])$/.exec(
    cookies(call.req.headers.cookie).get(LOGIN_COOKIE) ?? '',
  );
  return m ? { challenge: m[1]!, remember: m[2] === '1' } : undefined;
}

/** Text 1 of #401; the link fills in the code in the browser of the sign-in. */
const mailText = (code: string, link: string): string =>
  `Dein Anmeldecode lautet ${code}. Er gilt einmal und für zehn Minuten. Oder melde dich direkt mit diesem Link an: ${link}. Der Link funktioniert nur in dem Browser, in dem du die Anmeldung begonnen hast. Wenn du das nicht warst, ignoriere diese E-Mail.`;

/**
 * The mail goes in the background: a mail that failed shows only in the
 * admin's error log (101b). The code is in the fragment of the link, so it
 * reaches no server or proxy log.
 */
function mailLoginCode(
  d: AppDeps,
  user: User,
  code: string,
  requestId: string,
): void {
  const send = async (): Promise<void> =>
    d.mailer!({
      to: user.email!,
      subject: 'Dein Anmeldecode für Nova Imperium',
      text: mailText(code, `${d.cfg.publicUrl}/#code=${code}`),
    });
  void send().catch((error: unknown) => {
    d.log?.('Login code mail failed');
    noteServerError(
      d.ctx,
      {
        action: 'mail',
        error,
        player: user.id,
        requestId,
        version: d.news?.version,
      },
      d.log,
    );
  });
}

/** The password was right: a code by mail, the code form at once. */
export function beginLogin(
  d: AppDeps,
  u: User,
  requestId: string,
  remember: boolean,
): Reply {
  if (!d.mailer)
    throw new GameError('Anmeldecodes sind momentan nicht verfügbar.');
  if (!u.email)
    throw new GameError(
      'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.',
    );
  const { challenge, code } = security.issueLoginCode(d.ctx, u.id);
  mailLoginCode(d, u, code, requestId);
  return {
    json: { code: true },
    cookie: loginCookie(d.cfg, { challenge, remember }),
  };
}

/**
 * The code, typed or from the link (`link: true`). A link without the cookie
 * of the sign-in was opened in another browser (text 2); a link whose code
 * does not fit the sign-in under way is of an older one (130b). Every wrong
 * code counts as a failed attempt.
 */
function codeReply(d: AppDeps, call: Call, enter: Enter): Reply {
  const { body, requestId } = call;
  const signIn = signInOf(call);
  const challenge = signIn?.challenge;
  const link = body.link === true;
  const entry: AuditEntry = {
    category: 'account',
    action: 'loginCode',
    requestId,
  };
  if (link && !challenge) {
    record(d.ctx, entry, 'rejected');
    throw new GameError(OTHER_BROWSER);
  }
  const pending = security.loginPending(d.ctx, challenge);
  // Failed code checks increment the attempt counter. Keep that write even
  // when verification throws, outside the session-and-audit transaction.
  let user: User;
  try {
    user = security.completeLogin(d.ctx, challenge, body.code);
  } catch (error) {
    record(d.ctx, entry, error instanceof GameError ? 'rejected' : 'error');
    if (link && pending && error instanceof GameError)
      throw new GameError(OLDER_LINK);
    throw error;
  }
  entry.actor = user.id;
  const entered = audited(d.ctx, entry, () => enter(user, signIn!.remember));
  return {
    ...entered,
    cookie: [entered.cookie as string, loginCookie(d.cfg, null)],
  };
}

/** „Code erneut senden“ (101b): a new code by mail, in the background. */
function resendReply(d: AppDeps, call: Call): Reply {
  const signIn = signInOf(call);
  const next = security.resendLoginCode(d.ctx, signIn?.challenge);
  if (!next) return { json: { ok: true } };
  mailLoginCode(d, next.user, next.code, call.requestId);
  // The ten minutes start again, the cookie with them.
  return { json: { ok: true }, cookie: loginCookie(d.cfg, signIn!) };
}

export function loginCodeRoutes(
  d: AppDeps,
  guard: Guard,
  enter: Enter,
): Record<string, Handler> {
  const on = (): void => {
    if (!d.cfg.emailLoginCodes || !d.mailer)
      throw new GameError('Anmeldecodes sind nicht aktiviert.');
  };
  return {
    'POST /api/login/code': (call) => {
      guard(call.req);
      on();
      return codeReply(d, call, enter);
    },
    'POST /api/login/resend': (call) => {
      guard(call.req);
      on();
      return resendReply(d, call);
    },
    // A reload of the code step keeps the sign-in (129a).
    'GET /api/login/pending': (call) => ({
      json: {
        pending: security.loginPending(d.ctx, signInOf(call)?.challenge),
      },
    }),
    'POST /api/login/cancel': (call) => {
      security.cancelLogin(d.ctx, signInOf(call)?.challenge);
      return { json: { ok: true }, cookie: loginCookie(d.cfg, null) };
    },
  };
}
