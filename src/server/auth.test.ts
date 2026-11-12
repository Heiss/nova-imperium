import { scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as auth from './auth.ts';
import { addUser, testConfig, testCtx } from './test-helpers.ts';

const cfg = testConfig();
const DAY = 86400000;
const tokenOf = (link: string): string => link.split('#invite=')[1]!;

function invited(ctx = testCtx(), email = 'new@example.org') {
  const { link, invitation } = auth.createInvitation(ctx, cfg, null, email);
  return { ctx, token: tokenOf(link), invitation };
}

const reg = (
  token: string,
  over: Partial<auth.Registration> = {},
): auth.Registration => ({
  token,
  name: 'Neu',
  password: 'registration-passphrase',
  planet: 'Welt',
  gal: 2,
  ...over,
});

describe('passwords and tokens', () => {
  it('hash with scrypt and compare in constant time', () => {
    const u = { salt: 's', pw: auth.hashPassword('abc', 's') } as never;
    expect(auth.passwordMatches(u, 'abc')).toBe(true);
    expect(auth.passwordMatches(u, 'abd')).toBe(false);
    expect(auth.passwordMatches({ salt: 's', pw: 'ab' } as never, 'abc')).toBe(
      false,
    );
    expect(auth.hashToken('x')).toBe(
      '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
    );
    expect(auth.newToken()).toMatch(/^[\w-]{43}$/);
    expect(auth.newToken()).not.toBe(auth.newToken());
  });
});

describe('invitations', () => {
  it('put the token in the link fragment and store only its hash', () => {
    const { ctx, token, invitation } = invited();
    expect(auth.inviteLink(cfg, 'abc')).toBe(
      'http://localhost:8080/#invite=abc',
    );
    expect(invitation).toMatchObject({
      email: 'new@example.org',
      created: ctx.now(),
      expires: ctx.now() + 7 * DAY,
    });
    expect(invitation.tokenHash).toBe(auth.hashToken(token));
    expect(
      JSON.stringify(ctx.store.db.prepare('SELECT * FROM invitations').all()),
    ).not.toContain(token);
    expect(auth.openInvitation(ctx, token).id).toBe(invitation.id);
  });

  it('check the address and replace an open invitation of the same address', () => {
    const ctx = testCtx();
    expect(() => auth.createInvitation(ctx, cfg, null, 'nope')).toThrow(
      'gültige E-Mail',
    );
    expect(() => auth.createInvitation(ctx, cfg, null, 'a@b')).toThrow(
      'gültige E-Mail',
    );
    addUser(ctx, 'Anna');
    expect(() =>
      auth.createInvitation(ctx, cfg, null, 'ANNA@example.org'),
    ).toThrow('spielt schon');
    const first = invited(ctx, ' New@Example.org ');
    expect(first.invitation.email).toBe('new@example.org');
    const second = invited(ctx);
    expect(() => auth.openInvitation(ctx, first.token)).toThrow('ungültig');
    expect(auth.openInvitation(ctx, second.token).email).toBe(
      'new@example.org',
    );
  });

  it('expire', () => {
    const { ctx, token } = invited();
    ctx.clock.t += 7 * DAY - 1;
    expect(auth.openInvitation(ctx, token)).toBeTruthy();
    ctx.clock.t += 1;
    expect(() => auth.openInvitation(ctx, token)).toThrow('abgelaufen');
    expect(() => auth.openInvitation(ctx, undefined)).toThrow('ungültig');
  });
});

describe('registration', () => {
  it('creates a player with the address of the invitation, never an admin', () => {
    const { ctx, token } = invited();
    const u = auth.register(ctx, reg(token));
    expect(u).toMatchObject({
      name: 'Neu',
      email: 'new@example.org',
      admin: false,
      probes: 1,
    });
    expect(auth.passwordMatches(u, 'registration-passphrase')).toBe(true);
    const p = ctx.store.planetOfUser(u.id)!;
    expect(p).toMatchObject({ name: 'Welt', g: 2 });
    expect(() => auth.register(ctx, reg(token, { name: 'Zwei' }))).toThrow(
      'schon benutzt',
    );
  });

  it('shows a new player the explanation texts behind the (?) icon (#63, D2)', () => {
    const { ctx, token } = invited();
    const u = auth.register(ctx, reg(token));
    expect(u.explain).toBe('icon');
    expect(ctx.store.user(u.id)!.explain).toBe('icon');
  });

  it('uses defaults for planet name and galaxy', () => {
    const { ctx, token } = invited();
    const u = auth.register(ctx, reg(token, { planet: '', gal: 99 }));
    expect(ctx.store.planetOfUser(u.id)).toMatchObject({
      name: 'Heimatplanet',
      g: 2,
    });
  });

  it('checks name and password', () => {
    const { ctx, token } = invited();
    addUser(ctx, 'Anna');
    expect(() => auth.register(ctx, reg(token, { name: 'A' }))).toThrow(
      'mindestens 2 Zeichen',
    );
    expect(() => auth.register(ctx, reg(token, { password: '12345' }))).toThrow(
      'mindestens 15 Zeichen',
    );
    expect(() =>
      auth.register(ctx, reg(token, { password: 'x'.repeat(201) })),
    ).toThrow('höchstens 200');
    expect(() => auth.register(ctx, reg(token, { name: 'anna' }))).toThrow(
      'schon vergeben',
    );
    expect(
      auth.register(
        ctx,
        reg(token, { name: 'Ab', password: 'a long passphrase' }),
      ).name,
    ).toBe('Ab');
  });

  it('refuses an address that got an account meanwhile', () => {
    const { ctx, token } = invited();
    addUser(ctx, 'Other', { email: 'new@example.org' });
    expect(() => auth.register(ctx, reg(token))).toThrow('spielt schon');
  });
});

describe('login and sessions', () => {
  it('logs in by name in any case', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(auth.login(ctx, 'anna', 'secret1').name).toBe('Anna');
    expect(() => auth.login(ctx, 'Anna', 'wrong')).toThrow(
      'Name oder Passwort falsch.',
    );
    expect(() => auth.login(ctx, 'Nobody', 'secret1')).toThrow(
      'Name oder Passwort falsch.',
    );
    expect(() => auth.login(ctx, undefined, undefined)).toThrow(
      'Name oder Passwort falsch.',
    );
  });

  it('upgrades an existing scrypt password without requiring a reset', () => {
    const ctx = testCtx();
    const old = scryptSync('secret1', 'old-salt', 64).toString('hex');
    const user = addUser(ctx, 'Anna', { salt: 'old-salt', pw: old });
    expect(auth.login(ctx, 'Anna', 'secret1').pw).toMatch(/^scrypt-v2:/);
    expect(ctx.store.user(user.id)?.salt).not.toBe('old-salt');
    expect(auth.login(ctx, 'Anna', 'secret1').id).toBe(user.id);
  });

  it('keeps a session for the configured days', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const token = auth.startSession(ctx, cfg, 'u_Anna');
    expect(auth.sessionUser(ctx, token)?.name).toBe('Anna');
    expect(auth.sessionUser(ctx, undefined)).toBeNull();
    expect(auth.sessionUser(ctx, 'forged')).toBeNull();
    ctx.clock.t += 30 * DAY;
    expect(auth.sessionUser(ctx, token)).toBeNull();
    const t2 = auth.startSession(ctx, cfg, 'u_Anna');
    auth.endSession(ctx, t2);
    auth.endSession(ctx, undefined);
    expect(auth.sessionUser(ctx, t2)).toBeNull();
  });
});
