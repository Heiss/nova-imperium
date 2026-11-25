import { randomInt, timingSafeEqual } from 'node:crypto';
import {
  hashToken,
  newToken,
  passwordFields,
  passwordMatches,
  validatePassword,
} from './auth.ts';
import {
  hasAuthenticator,
  takeAppCode,
  WRONG_APP_CODE,
} from './authenticator.ts';
import { NUMBERS } from './config.ts';
import type { User } from './db/repos/players.ts';
import { fail, type Ctx } from './game/context.ts';
import type { RoundReset } from './db/round-reset.ts';

const RESET_LIFE = 30 * 60_000;
const CODE_LIFE = 10 * 60_000;
const CODE_ATTEMPTS = 5;
/** „Code erneut senden“ comes after 30 s (owner, 2026-11-25, 101b, #401). */
const RESEND_AFTER = 30_000;
const RESET_COOLDOWN = 60_000;

interface AccountToken {
  token_hash: string;
  user_id: string;
  code_hash: string | null;
  attempts: number;
}

function saveToken(
  ctx: Ctx,
  uid: string,
  purpose: 'reset' | 'login',
  token: string,
  life: number,
  code: string | null,
): void {
  ctx.db
    .prepare(
      `
    INSERT INTO account_tokens (token_hash, user_id, purpose, code_hash, expires)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id) WHERE purpose = 'login' DO UPDATE SET
      token_hash = excluded.token_hash, code_hash = excluded.code_hash,
      expires = excluded.expires, attempts = 0
  `,
    )
    .run(hashToken(token), uid, purpose, code, ctx.now() + life);
}

export function issueReset(
  ctx: Ctx,
  raw: unknown,
): { email: string; token: string } | null {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  const user = ctx.players.byEmail(email);
  const address = user?.email;
  if (!user || !address) return null;
  return ctx.tx(() => {
    const pending = ctx.db
      .prepare(
        "SELECT 1 FROM account_tokens WHERE user_id = ? AND purpose = 'reset' AND expires > ?",
      )
      .get(user.id, ctx.now() + RESET_LIFE - RESET_COOLDOWN);
    if (pending) return null;
    const token = newToken();
    saveToken(ctx, user.id, 'reset', token, RESET_LIFE, null);
    return { email: address, token };
  });
}

function replacePassword(
  ctx: Ctx,
  user: User,
  password: string,
  minimum: number,
): void {
  validatePassword(password, minimum);
  const { pw, salt } = passwordFields(password);
  const update = ctx.db
    .prepare(
      'UPDATE users SET pw_hash = ?, salt = ? WHERE id = ? AND pw_hash = ? AND salt = ?',
    )
    .run(pw, salt, user.id, user.pw, user.salt);
  if (!update.changes) fail('Das Passwort wurde bereits geändert.');
  ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  ctx.db.prepare('DELETE FROM account_tokens WHERE user_id = ?').run(user.id);
}

export function changePassword(
  ctx: Ctx,
  user: User,
  old: unknown,
  next: unknown,
  minimum: number = NUMBERS.passwordMinLength.def,
): void {
  if (!passwordMatches(user, String(old ?? '')))
    fail('Das bisherige Passwort ist falsch.');
  ctx.tx(() => replacePassword(ctx, user, String(next ?? ''), minimum));
}

/** The account of a live reset link: known, not expired, not used up. */
function resetUserOf(ctx: Ctx, token: unknown): User | null {
  const record = ctx.db
    .prepare(
      "SELECT user_id FROM account_tokens WHERE token_hash = ? AND purpose = 'reset' AND expires > ? AND attempts < ?",
    )
    .get(hashToken(String(token ?? '')), ctx.now(), CODE_ATTEMPTS) as
    Pick<AccountToken, 'user_id'> | undefined;
  return (record && ctx.players.get(record.user_id)) ?? null;
}

/** Whether the page of a reset link asks for the code of the app (text 6, 104). */
export const resetNeedsApp = (ctx: Ctx, token: unknown): boolean => {
  const user = resetUserOf(ctx, token);
  return user !== null && hasAuthenticator(ctx, user.id);
};

/**
 * The new password of a reset link. With an authenticator app the link alone
 * sets none: the code of the app is asked too, a wrong one counts like a
 * wrong mail code, and the app stays (104, #401).
 */
export function resetPassword(
  ctx: Ctx,
  token: unknown,
  next: unknown,
  minimum: number = NUMBERS.passwordMinLength.def,
  appCode?: unknown,
): void {
  const user = resetUserOf(ctx, token);
  if (!user) return fail('Dieser Link ist ungültig oder abgelaufen.');
  const password = String(next ?? '');
  if (hasAuthenticator(ctx, user.id)) {
    // A code is taken only for a password that will be set.
    validatePassword(password, minimum);
    if (!ctx.tx(() => takeAppCode(ctx, user.id, appCode))) {
      ctx.db
        .prepare(
          "UPDATE account_tokens SET attempts = attempts + 1 WHERE token_hash = ? AND purpose = 'reset'",
        )
        .run(hashToken(String(token ?? '')));
      return fail(WRONG_APP_CODE);
    }
  }
  ctx.tx(() => {
    replacePassword(ctx, user, password, minimum);
    ctx.db.prepare('DELETE FROM passkeys WHERE user_id = ?').run(user.id);
  });
}

/** Six digits, the code of a sign-in mail. */
const newCode = (): string => String(randomInt(1_000_000)).padStart(6, '0');

/**
 * A sign-in that waits for the code of the authenticator app (102a, #401):
 * the challenge of the browser as for a mail code, but no mail code (its
 * `code_hash` is empty), so the code of the app is the only way in.
 */
export function issueAppLogin(ctx: Ctx, uid: string): string {
  const challenge = newToken();
  saveToken(ctx, uid, 'login', challenge, CODE_LIFE, null);
  return challenge;
}

export function issueLoginCode(
  ctx: Ctx,
  uid: string,
): { challenge: string; code: string } {
  const challenge = newToken();
  const code = newCode();
  // The high-entropy challenge is sent to the client but not stored in the DB.
  saveToken(
    ctx,
    uid,
    'login',
    challenge,
    CODE_LIFE,
    hashToken(challenge + code),
  );
  return { challenge, code };
}

function verifyCode(ctx: Ctx, challenge: string, code: string): User | null {
  const hash = hashToken(challenge);
  const record = liveLogin(ctx, challenge);
  if (!record) return null;
  if (!codeFits(ctx, record, challenge, code)) {
    ctx.db
      .prepare(
        'UPDATE account_tokens SET attempts = attempts + 1 WHERE token_hash = ?',
      )
      .run(hash);
    return null;
  }
  ctx.db.prepare('DELETE FROM account_tokens WHERE token_hash = ?').run(hash);
  return ctx.players.get(record.user_id);
}

/** The code of the mail, or of the app for a sign-in without a mail code. */
function codeFits(
  ctx: Ctx,
  record: AccountToken,
  challenge: string,
  code: string,
): boolean {
  if (record.code_hash === null) return takeAppCode(ctx, record.user_id, code);
  const expected = Buffer.from(record.code_hash, 'hex');
  const actual = Buffer.from(hashToken(challenge + code), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Whether the sign-in of this browser waits for the code of the app (102a). */
export const appLoginPending = (ctx: Ctx, challenge: unknown): boolean =>
  typeof challenge === 'string' &&
  liveLogin(ctx, challenge)?.code_hash === null;

/** A live sign-in by mail code: the challenge is known, not used, not expired, not used up. */
function liveLogin(
  ctx: Ctx,
  challenge: string,
): (AccountToken & { expires: number }) | undefined {
  return ctx.db
    .prepare(
      "SELECT * FROM account_tokens WHERE token_hash = ? AND purpose = 'login' AND expires > ? AND attempts < ?",
    )
    .get(hashToken(challenge), ctx.now(), CODE_ATTEMPTS) as
    (AccountToken & { expires: number }) | undefined;
}

/** Whether the sign-in of this browser waits for its code (129a, #401). */
export const loginPending = (ctx: Ctx, challenge: unknown): boolean =>
  typeof challenge === 'string' && liveLogin(ctx, challenge) !== undefined;

/** „Zurück zum Login“: the sign-in under way ends (#401). */
export function cancelLogin(ctx: Ctx, challenge: unknown): void {
  if (typeof challenge !== 'string') return;
  ctx.db
    .prepare(
      "DELETE FROM account_tokens WHERE token_hash = ? AND purpose = 'login'",
    )
    .run(hashToken(challenge));
}

/**
 * A new code for a sign-in under way, on the same challenge (101b, #401): the
 * old code is void, the ten minutes start again, the failed attempts stay. A
 * code is sent once in 30 s; an earlier ask sends nothing (null), as the
 * button comes only after 30 s. An unknown, expired or used-up challenge is
 * refused like a wrong code.
 */
export function resendLoginCode(
  ctx: Ctx,
  challenge: unknown,
): { user: User; code: string } | null {
  const c = String(challenge ?? '');
  const now = ctx.now();
  const record = liveLogin(ctx, c);
  const user = record && ctx.players.get(record.user_id);
  // A sign-in with the app has no mail code and no way out by mail (102a).
  if (!record || !user || record.code_hash === null)
    return fail('Der Anmeldecode ist ungültig oder abgelaufen.');
  // The code was sent when its ten minutes began.
  if (now < record.expires - CODE_LIFE + RESEND_AFTER) return null;
  const code = newCode();
  ctx.db
    .prepare(
      'UPDATE account_tokens SET code_hash = ?, expires = ? WHERE token_hash = ?',
    )
    .run(hashToken(c + code), now + CODE_LIFE, record.token_hash);
  return { user, code };
}

export function completeLogin(
  ctx: Ctx,
  challenge: unknown,
  code: unknown,
): User {
  const user = ctx.tx(() =>
    verifyCode(ctx, String(challenge ?? ''), String(code ?? '').trim()),
  );
  if (user) return user;
  // A sign-in with the app has the text of the app, also once its attempts
  // are used up (owner, 2026-11-25, 137a).
  return fail(
    appLogin(ctx, challenge)
      ? WRONG_APP_CODE
      : 'Der Anmeldecode ist ungültig oder abgelaufen.',
  );
}

/** Whether a challenge was a sign-in with the app, used up or not. */
const appLogin = (ctx: Ctx, challenge: unknown): boolean =>
  typeof challenge === 'string' &&
  (
    ctx.db
      .prepare(
        "SELECT code_hash FROM account_tokens WHERE token_hash = ? AND purpose = 'login'",
      )
      .get(hashToken(challenge)) as { code_hash: string | null } | undefined
  )?.code_hash === null;

export function purgeAccountTokens(ctx: Ctx): void {
  ctx.db
    .prepare('DELETE FROM account_tokens WHERE expires <= ?')
    .run(ctx.now());
}

export const roundReset = [
  { keeps: ['account_tokens'] },
] satisfies readonly RoundReset[];
