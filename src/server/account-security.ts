import { randomInt, timingSafeEqual } from 'node:crypto';
import {
  hashToken,
  newToken,
  passwordFields,
  passwordMatches,
  validatePassword,
} from './auth.ts';
import type { User } from './db/store.ts';
import { fail, type Ctx } from './game/context.ts';

const RESET_LIFE = 30 * 60_000;
const CODE_LIFE = 10 * 60_000;
const CODE_ATTEMPTS = 5;
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
  ctx.store.db
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
  const user = ctx.store.userByEmail(email);
  const address = user?.email;
  if (!user || !address) return null;
  return ctx.store.tx(() => {
    const pending = ctx.store.db
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

function replacePassword(ctx: Ctx, user: User, password: string): void {
  validatePassword(password);
  const { pw, salt } = passwordFields(password);
  const update = ctx.store.db
    .prepare(
      'UPDATE users SET pw_hash = ?, salt = ? WHERE id = ? AND pw_hash = ? AND salt = ?',
    )
    .run(pw, salt, user.id, user.pw, user.salt);
  if (!update.changes) fail('Das Passwort wurde bereits geändert.');
  ctx.store.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  ctx.store.db
    .prepare('DELETE FROM account_tokens WHERE user_id = ?')
    .run(user.id);
}

export function changePassword(
  ctx: Ctx,
  user: User,
  old: unknown,
  next: unknown,
): void {
  if (!passwordMatches(user, String(old ?? '')))
    fail('Das bisherige Passwort ist falsch.');
  ctx.store.tx(() => replacePassword(ctx, user, String(next ?? '')));
}

export function resetPassword(ctx: Ctx, token: unknown, next: unknown): void {
  ctx.store.tx(() => {
    const record = ctx.store.db
      .prepare(
        "SELECT user_id FROM account_tokens WHERE token_hash = ? AND purpose = 'reset' AND expires > ?",
      )
      .get(hashToken(String(token ?? '')), ctx.now()) as
      Pick<AccountToken, 'user_id'> | undefined;
    const user = record && ctx.store.user(record.user_id);
    if (!user) return fail('Dieser Link ist ungültig oder abgelaufen.');
    replacePassword(ctx, user, String(next ?? ''));
    ctx.store.db.prepare('DELETE FROM passkeys WHERE user_id = ?').run(user.id);
  });
}

export function issueLoginCode(
  ctx: Ctx,
  uid: string,
): { challenge: string; code: string } {
  const challenge = newToken();
  const code = String(randomInt(1_000_000)).padStart(6, '0');
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
  const record = ctx.store.db
    .prepare(
      "SELECT * FROM account_tokens WHERE token_hash = ? AND purpose = 'login' AND expires > ? AND attempts < ?",
    )
    .get(hash, ctx.now(), CODE_ATTEMPTS) as AccountToken | undefined;
  if (!record) return null;
  const expected = Buffer.from(record.code_hash ?? '', 'hex');
  const actual = Buffer.from(hashToken(challenge + code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    ctx.store.db
      .prepare(
        'UPDATE account_tokens SET attempts = attempts + 1 WHERE token_hash = ?',
      )
      .run(hash);
    return null;
  }
  ctx.store.db
    .prepare('DELETE FROM account_tokens WHERE token_hash = ?')
    .run(hash);
  return ctx.store.user(record.user_id);
}

export function completeLogin(
  ctx: Ctx,
  challenge: unknown,
  code: unknown,
): User {
  const user = ctx.store.tx(() =>
    verifyCode(ctx, String(challenge ?? ''), String(code ?? '').trim()),
  );
  if (!user) return fail('Der Anmeldecode ist ungültig oder abgelaufen.');
  return user;
}

export function purgeAccountTokens(ctx: Ctx): void {
  ctx.store.db
    .prepare('DELETE FROM account_tokens WHERE expires <= ?')
    .run(ctx.now());
}
