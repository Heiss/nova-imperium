// The authenticator app of an account (#401, owner, 2026-11-25): a further
// second factor (97b). With one set up, a sign-in with the password asks for
// its code and never for a mail code (102a); a lost app is reset by the admin
// only (103c); „Passwort vergessen“ asks for its code too and keeps it (104).
// The secret is stored plain like the VAPID key (127a), in the table `totp`
// that no reader of `users` sees; it never leaves the server but once, as
// the address of the QR code at the setup.
import { passwordMatches } from './auth.ts';
import type { User } from './db/repos/players.ts';
import type { RoundReset } from './db/round-reset.ts';
import { fail, type Ctx } from './game/context.ts';
import { newSecret, otpauthUri, verifyTotp } from './totp.ts';

/** A setup shown but not confirmed lasts ten minutes, as a mail code. */
const SETUP_LIFE = 10 * 60_000;
const ATTEMPTS = 5;

/**
 * [U] The owner has not given a text for a wrong code of the app yet
 * (question to the owner, 2026-11-25); until then the text of a wrong mail
 * code.
 */
export const WRONG_APP_CODE = 'Der Anmeldecode ist ungültig oder abgelaufen.';
/** A request the page does not send: a setup while one is set up. */
const REFUSED = 'Anfrage abgelehnt.';

interface Row {
  secret: string;
  confirmed: number;
  created: number;
  last_step: number | null;
  attempts: number;
}

const rowOf = (ctx: Ctx, uid: string): Row | undefined =>
  ctx.db.prepare('SELECT * FROM totp WHERE user_id = ?').get(uid) as
    Row | undefined;

/** Whether the account signs in with the code of its app. */
export const hasAuthenticator = (ctx: Ctx, uid: string): boolean =>
  rowOf(ctx, uid)?.confirmed === 1;

/**
 * Takes a code of the set-up app: a step after the last one taken, which
 * becomes the last; false for a wrong or used code, or no app.
 */
export function takeAppCode(ctx: Ctx, uid: string, code: unknown): boolean {
  const row = rowOf(ctx, uid);
  if (row?.confirmed !== 1) return false;
  const step = verifyTotp(row.secret, code, ctx.now(), row.last_step);
  if (step === null) return false;
  ctx.db
    .prepare('UPDATE totp SET last_step = ? WHERE user_id = ?')
    .run(step, uid);
  return true;
}

/** „Einrichten“: a new secret, shown once as the address of the QR code. */
export function beginSetup(
  ctx: Ctx,
  user: User,
): { uri: string; secret: string } {
  if (hasAuthenticator(ctx, user.id)) return fail(REFUSED);
  const secret = newSecret();
  ctx.db
    .prepare(
      `INSERT INTO totp (user_id, secret, confirmed, created) VALUES (?, ?, 0, ?)
       ON CONFLICT (user_id) DO UPDATE SET secret = excluded.secret,
         created = excluded.created, last_step = NULL, attempts = 0`,
    )
    .run(user.id, secret, ctx.now());
  return { uri: otpauthUri(secret, user.name), secret };
}

/**
 * The first code of the app confirms the setup; from then on the account
 * signs in with it. A wrong code counts; the fifth ends the setup.
 */
export function confirmSetup(ctx: Ctx, user: User, code: unknown): void {
  const row = rowOf(ctx, user.id);
  if (!row || row.confirmed === 1 || row.created + SETUP_LIFE <= ctx.now())
    return fail(WRONG_APP_CODE);
  const step = verifyTotp(row.secret, code, ctx.now(), null);
  if (step === null) {
    if (row.attempts + 1 >= ATTEMPTS)
      ctx.db.prepare('DELETE FROM totp WHERE user_id = ?').run(user.id);
    else
      ctx.db
        .prepare('UPDATE totp SET attempts = attempts + 1 WHERE user_id = ?')
        .run(user.id);
    return fail(WRONG_APP_CODE);
  }
  ctx.db
    .prepare(
      'UPDATE totp SET confirmed = 1, last_step = ?, attempts = 0 WHERE user_id = ?',
    )
    .run(step, user.id);
}

/** „Entfernen“ asks for the password and a code of the app (text 4). */
export function removeAuthenticator(
  ctx: Ctx,
  user: User,
  password: unknown,
  code: unknown,
): void {
  if (!passwordMatches(user, String(password ?? '')))
    return fail('Das bisherige Passwort ist falsch.');
  if (!takeAppCode(ctx, user.id, code)) return fail(WRONG_APP_CODE);
  ctx.db.prepare('DELETE FROM totp WHERE user_id = ?').run(user.id);
}

/** The admin resets a lost app (103c); the account signs in by mail again. */
export function resetAuthenticator(ctx: Ctx, uid: string): void {
  ctx.db.prepare('DELETE FROM totp WHERE user_id = ?').run(uid);
}

/** The app of an account stays across rounds, as the account does. */
export const roundReset = [{ keeps: ['totp'] }] satisfies readonly RoundReset[];
