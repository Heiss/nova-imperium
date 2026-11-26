import { describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  completeLogin,
  issueLoginCode,
  issueReset,
  purgeAccountTokens,
  resendLoginCode,
  resetPassword,
} from './account-security.ts';
import { hashToken, passwordMatches } from './auth.ts';
import { beginSetup, confirmSetup } from './authenticator.ts';
import type { User } from './db/repos/players.ts';
import { GameError, type Ctx } from './game/context.ts';
import { addUser, testCtx } from './test-helpers.ts';
import { hotp, stepOf, unbase32 } from './totp.ts';

// The password check is the cost of every change here; the result of the same
// password and salt is computed once (src/test/scrypt-memo.ts).
vi.mock('node:crypto', async (original) => ({
  ...(await import('../test/scrypt-memo.ts')).memoScrypt(
    await original<typeof import('node:crypto')>(),
  ),
  randomInt: () => 42,
}));

const NEW = 'a new long passphrase';
const MIN = 15;

function setup() {
  const ctx = testCtx();
  const user = addUser(ctx, 'Pilot');
  const db = ctx.db;
  db.prepare('INSERT INTO sessions VALUES (?, ?, 9e9)').run('s', user.id);
  const count = (table: string) =>
    (
      db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`)
        .get(user.id) as { n: number }
    ).n;
  return { ctx, user, db, count };
}

const refuses = (f: () => unknown, message: string) =>
  expect(f).toThrow(new GameError(message));

describe('password reset', () => {
  it('finds the account by its address in any case and with spaces', () => {
    const { ctx } = setup();
    expect(issueReset(ctx, '  PILOT@Example.org ')).toMatchObject({
      email: 'pilot@example.org',
    });
    expect(issueReset(ctx, 'nobody@example.org')).toBeNull();
    expect(issueReset(ctx, undefined)).toBeNull();
  });

  it('issues a new link only after a minute', () => {
    const { ctx } = setup();
    expect(issueReset(ctx, 'pilot@example.org')).not.toBeNull();
    ctx.clock.t += 59_999;
    expect(issueReset(ctx, 'pilot@example.org')).toBeNull();
    ctx.clock.t += 1;
    expect(issueReset(ctx, 'pilot@example.org')).not.toBeNull();
  });

  it('sets the password once, signs out everywhere and removes the passkeys', () => {
    const { ctx, user, db, count } = setup();
    db.prepare("INSERT INTO passkeys VALUES ('k', ?, x'00', 0, 0)").run(
      user.id,
    );
    const { token } = issueReset(ctx, user.email)!;
    resetPassword(ctx, token, NEW, MIN);
    const after = ctx.players.get(user.id)!;
    expect(passwordMatches(after, NEW)).toBe(true);
    expect(count('sessions')).toBe(0);
    expect(count('account_tokens')).toBe(0);
    expect(count('passkeys')).toBe(0);
    refuses(
      () => resetPassword(ctx, token, NEW, MIN),
      'Dieser Link ist ungültig oder abgelaufen.',
    );
  });

  it('refuses an expired link and a too short password', () => {
    const { ctx, user } = setup();
    const { token } = issueReset(ctx, user.email)!;
    refuses(
      () => resetPassword(ctx, token, 'short', MIN),
      `Das Passwort braucht mindestens ${MIN} Zeichen.`,
    );
    ctx.clock.t += 30 * 60_000;
    refuses(
      () => resetPassword(ctx, token, NEW, MIN),
      'Dieser Link ist ungültig oder abgelaufen.',
    );
    refuses(
      () => resetPassword(ctx, undefined, NEW, MIN),
      'Dieser Link ist ungültig oder abgelaufen.',
    );
  });
});

describe('password change', () => {
  it('needs the current password', () => {
    const { ctx, user } = setup();
    refuses(
      () => changePassword(ctx, user, 'wrong', NEW, MIN),
      'Das bisherige Passwort ist falsch.',
    );
    refuses(
      () => changePassword(ctx, user, undefined, NEW, MIN),
      'Das bisherige Passwort ist falsch.',
    );
  });

  it('refuses a stale account so two changes cannot both win', () => {
    const { ctx, user, count } = setup();
    changePassword(ctx, user, 'secret1', NEW, MIN);
    expect(count('sessions')).toBe(0);
    refuses(
      () => changePassword(ctx, user, 'secret1', 'another passphrase', MIN),
      'Das Passwort wurde bereits geändert.',
    );
    expect(passwordMatches(ctx.players.get(user.id)!, NEW)).toBe(true);
  });
});

describe('login codes', () => {
  it('has six digits, also with leading zeros, and accepts spaces around it', () => {
    const { ctx, user } = setup();
    const { challenge, code } = issueLoginCode(ctx, user.id);
    expect(code).toBe('000042');
    expect(completeLogin(ctx, challenge, ' 000042 ').id).toBe(user.id);
    refuses(
      () => completeLogin(ctx, challenge, code),
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
  });

  it('allows five wrong attempts and expires after ten minutes', () => {
    const { ctx, user } = setup();
    const first = issueLoginCode(ctx, user.id);
    for (let i = 0; i < 5; i++)
      refuses(
        () => completeLogin(ctx, first.challenge, '999999'),
        'Der Anmeldecode ist ungültig oder abgelaufen.',
      );
    refuses(
      () => completeLogin(ctx, first.challenge, first.code),
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
    const second = issueLoginCode(ctx, user.id);
    ctx.clock.t += 10 * 60_000;
    refuses(
      () => completeLogin(ctx, second.challenge, second.code),
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
    refuses(
      () => completeLogin(ctx, undefined, undefined),
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
  });

  it('counts a stored code of the wrong length as a wrong attempt', () => {
    const { ctx, user, db } = setup();
    const { challenge, code } = issueLoginCode(ctx, user.id);
    db.prepare('UPDATE account_tokens SET code_hash = ?').run('ab');
    refuses(
      () => completeLogin(ctx, challenge, code),
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
    expect(
      db
        .prepare('SELECT attempts FROM account_tokens WHERE token_hash = ?')
        .get(hashToken(challenge)),
    ).toEqual({ attempts: 1 });
  });

  it('purges expired tokens only', () => {
    const { ctx, user, count } = setup();
    issueLoginCode(ctx, user.id);
    ctx.clock.t += 10 * 60_000 - 1;
    purgeAccountTokens(ctx);
    expect(count('account_tokens')).toBe(1);
    ctx.clock.t += 1;
    purgeAccountTokens(ctx);
    expect(count('account_tokens')).toBe(0);
  });
});

// A sign-in by mail code begun in one browser, the app set up in another
// (102a, 103c, CodeRabbit of #417): the mail code no longer signs in.
describe('login codes after the app is set up', () => {
  const WRONG_MAIL = 'Der Anmeldecode ist ungültig oder abgelaufen.';
  /** Sets up the app of the user with its first code. */
  function setUpApp(ctx: Ctx, user: User) {
    const { secret } = beginSetup(ctx, user);
    confirmSetup(ctx, user, hotp(unbase32(secret)!, stepOf(ctx.now())));
  }

  it('ends the sign-in by mail code under way when the app is set up', () => {
    const { ctx, user, count } = setup();
    const { challenge, code } = issueLoginCode(ctx, user.id);
    setUpApp(ctx, user);
    expect(count('account_tokens')).toBe(0);
    refuses(() => completeLogin(ctx, challenge, code), WRONG_MAIL);
    ctx.clock.t += 30_000;
    refuses(() => resendLoginCode(ctx, challenge), WRONG_MAIL);
  });

  it('refuses a mail code of an account with the app, also one left over', () => {
    const { ctx, user, db } = setup();
    setUpApp(ctx, user);
    // A mail code stored by any other way, e.g. before the app.
    const { challenge, code } = issueLoginCode(ctx, user.id);
    refuses(() => completeLogin(ctx, challenge, code), WRONG_MAIL);
    expect(
      db
        .prepare('SELECT attempts FROM account_tokens WHERE token_hash = ?')
        .get(hashToken(challenge)),
    ).toEqual({ attempts: 1 });
    ctx.clock.t += 30_000;
    refuses(() => resendLoginCode(ctx, challenge), WRONG_MAIL);
  });

  it('leaves the sign-in by mail code of an account without the app as it is', () => {
    const { ctx, user } = setup();
    const other = addUser(ctx, 'Lotse');
    const { challenge } = issueLoginCode(ctx, user.id);
    setUpApp(ctx, other);
    ctx.clock.t += 30_000;
    const sent = resendLoginCode(ctx, challenge);
    expect(sent?.user.id).toBe(user.id);
    expect(completeLogin(ctx, challenge, sent!.code).id).toBe(user.id);
  });
});
