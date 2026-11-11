// Limits of authentication that are not visible in the result alone: when
// scrypt runs (equal work for unknown accounts, none for oversized input),
// suspended accounts, the stored hash profile and the address check.
import * as crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as auth from './auth.ts';
import { GameError } from './game/context.ts';
import { addUser, testConfig, testCtx } from './test-helpers.ts';

vi.mock('node:crypto', async (original) => {
  const real = await original<typeof import('node:crypto')>();
  return { ...real, scryptSync: vi.fn(real.scryptSync) };
});

const scrypt = vi.mocked(crypto.scryptSync);
const cfg = testConfig();
const MAX = 200;
const PROFILE = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

afterEach(() => scrypt.mockClear());

function suspended() {
  const ctx = testCtx();
  const u = addUser(ctx, 'Banned', {
    ...auth.passwordFields('a long passphrase'),
  });
  ctx.store.db
    .prepare("INSERT INTO suspensions VALUES (?, 'Spam', NULL)")
    .run(u.id);
  return { ctx, u };
}

describe('scrypt work', () => {
  it('hashes with the OWASP profile', () => {
    auth.hashPassword('pw', 'salt');
    expect(scrypt).toHaveBeenCalledWith('pw', 'salt', 64, PROFILE);
  });

  it('does the same work for an unknown name, but not for oversized input', () => {
    const ctx = testCtx();
    expect(() => auth.login(ctx, 'nobody', 'x'.repeat(2 * MAX))).toThrow(
      new GameError('Name oder Passwort falsch.'),
    );
    expect(scrypt).toHaveBeenCalledTimes(1);
    expect(scrypt).toHaveBeenCalledWith(
      'x'.repeat(2 * MAX),
      'unknown-account',
      64,
      PROFILE,
    );
    scrypt.mockClear();
    expect(() => auth.login(ctx, 'nobody', 'x'.repeat(2 * MAX + 1))).toThrow(
      new GameError('Name oder Passwort falsch.'),
    );
    expect(scrypt).not.toHaveBeenCalled();
  });

  it('compares passwords up to twice the maximum, longer ones without work', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    scrypt.mockClear();
    expect(auth.passwordMatches(u, 'x'.repeat(2 * MAX))).toBe(false);
    expect(scrypt).toHaveBeenCalledTimes(1);
    scrypt.mockClear();
    expect(auth.passwordMatches(u, 'x'.repeat(2 * MAX + 1))).toBe(false);
    expect(scrypt).not.toHaveBeenCalled();
  });

  it('keeps a modern hash on login and upgrades only legacy ones', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    const before = ctx.store.user(u.id)!;
    auth.login(ctx, 'Anna', 'secret1');
    expect(ctx.store.user(u.id)).toMatchObject({
      salt: before.salt,
      pw: before.pw,
    });
  });
});

describe('suspended accounts', () => {
  it('cannot log in, start a session or use an old one', () => {
    const { ctx, u } = suspended();
    expect(() => auth.login(ctx, 'Banned', 'a long passphrase')).toThrow(
      new GameError('Dieses Konto ist gesperrt.'),
    );
    expect(() => auth.startSession(ctx, cfg, u.id)).toThrow(
      new GameError('Dieses Konto ist gesperrt.'),
    );
    ctx.store.addSession(auth.hashToken('t'), u.id, ctx.now() + 1000);
    expect(auth.sessionUser(ctx, 't')).toBeNull();
    ctx.store.db.prepare('DELETE FROM suspensions').run();
    expect(auth.sessionUser(ctx, 't')?.id).toBe(u.id);
  });
});

describe('registration limits', () => {
  it('accepts a password of exactly the maximum length and gives ids with a u', () => {
    const ctx = testCtx();
    const { link } = auth.createInvitation(ctx, cfg, null, 'new@example.org');
    const u = auth.register(ctx, {
      token: link.split('#invite=')[1]!,
      name: 'Neu',
      password: 'x'.repeat(MAX),
      planet: 'Welt',
      gal: 1,
    });
    expect(u.id).toMatch(/^uid\d+$/);
  });

  it('refuses addresses with extra text before or after them', () => {
    const ctx = testCtx();
    for (const email of ['"x"a@b.co', 'a@b.co"x', 'Anna <a@b.co'])
      expect(() => auth.createInvitation(ctx, cfg, null, email)).toThrow(
        new GameError('Bitte eine gültige E-Mail-Adresse eingeben.'),
      );
  });
});
