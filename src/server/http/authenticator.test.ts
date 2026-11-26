// The authenticator app over HTTP (#401, owner, 2026-11-25): the setup of
// „Optionen“ → „Konto“, the sign-in with its code (102a), its removal, the
// admin's reset (103c) and „Passwort vergessen“ with it (104). The secret
// leaves the server once, at the setup.
import { describe, expect, it } from 'vitest';
import type { Mail } from '../mail.ts';
import { addPlanet, addUser } from '../test-helpers.ts';
import { hotp, stepOf, unbase32 } from '../totp.ts';
import { start } from '../../test/http.ts';

/** The new password of a reset in these tests. */
const NEXT = 'ein-neues-passwort-1';

const tick = () => new Promise((r) => setImmediate(r));
const WRONG = 'Der Code der Authenticator-App ist ungültig.';
const MAIL_WRONG = 'Der Anmeldecode ist ungültig oder abgelaufen.';

async function anna(cfg: { emailLoginCodes?: boolean } = {}) {
  const mails: Mail[] = [];
  const s = await start({ cfg, mailer: async (m) => void mails.push(m) });
  addUser(s.ctx, 'Anna');
  addPlanet(s.ctx, 'u_Anna');
  const login = (password = 'secret1') =>
    s.call('POST', '/api/login', { name: 'Anna', password });
  return { ...s, mails, login };
}

type Session = Awaited<ReturnType<typeof anna>>;

/** Signs in without codes, sets the app up and signs out; the secret. */
async function withApp(s: Session): Promise<string> {
  s.ctx.db.prepare('DELETE FROM totp').run();
  const codes = s.cfg.emailLoginCodes;
  s.cfg.emailLoginCodes = false;
  await s.login();
  s.cfg.emailLoginCodes = codes;
  const setup = await s.call('POST', '/api/totp/setup', {});
  const { secret } = setup.json as { secret: string };
  expect(
    (await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) }))
      .json,
  ).toEqual({ ok: true });
  s.ctx.clock.t += 30_000;
  await s.call('POST', '/api/logout', {});
  return secret;
}

const codeOf = (s: Session, secret: string, steps = 0): string =>
  hotp(unbase32(secret)!, stepOf(s.ctx.clock.t) + steps);

describe('the setup of the app (text 4)', () => {
  it('shows the address of the QR code once and takes the first code', async () => {
    const s = await anna();
    await s.login();
    const setup = await s.call('POST', '/api/totp/setup', {});
    const { uri, secret } = setup.json as { uri: string; secret: string };
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(uri).toBe(
      `otpauth://totp/Nova%20Imperium%3AAnna?secret=${secret}&issuer=Nova%20Imperium&algorithm=SHA1&digits=6&period=30`,
    );
    // Not set up before the first code.
    let state = (await s.call('GET', '/api/state')).json as {
      me: { totp: boolean };
    };
    expect(state.me.totp).toBe(false);
    expect(
      (await s.call('POST', '/api/totp/confirm', { code: '000000' })).json,
    ).toEqual({ error: WRONG });
    expect(
      (await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) }))
        .json,
    ).toEqual({ ok: true });
    state = (await s.call('GET', '/api/state')).json as typeof state;
    expect(state.me.totp).toBe(true);
    // The state says yes or no, never the secret.
    expect(JSON.stringify(state)).not.toContain(secret);
    // A second setup is refused while one is set up.
    expect((await s.call('POST', '/api/totp/setup', {})).json).toEqual({
      error: 'Anfrage abgelehnt.',
    });
  });

  it('ends a setup after five wrong codes or ten minutes', async () => {
    const s = await anna();
    await s.login();
    let { secret } = (await s.call('POST', '/api/totp/setup', {})).json as {
      secret: string;
    };
    for (let i = 0; i < 5; i++)
      await s.call('POST', '/api/totp/confirm', { code: '000000' });
    expect(
      (await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) }))
        .json,
    ).toEqual({ error: WRONG });
    ({ secret } = (await s.call('POST', '/api/totp/setup', {})).json as {
      secret: string;
    });
    s.ctx.clock.t += 10 * 60_000;
    expect(
      (await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) }))
        .json,
    ).toEqual({ error: WRONG });
  });

  it('takes the first code until the end of the ten minutes', async () => {
    const s = await anna();
    await s.login();
    const { secret } = (await s.call('POST', '/api/totp/setup', {})).json as {
      secret: string;
    };
    s.ctx.clock.t += 10 * 60_000 - 1;
    expect(
      (await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) }))
        .json,
    ).toEqual({ ok: true });
    // Set up, a further code confirms nothing.
    s.ctx.clock.t += 30_000;
    expect(
      (await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) }))
        .json,
    ).toEqual({ error: WRONG });
  });

  it('audits every change of the own app with its outcome, never the secret', async () => {
    const s = await anna();
    await s.login();
    const { secret } = (await s.call('POST', '/api/totp/setup', {})).json as {
      secret: string;
    };
    await s.call('POST', '/api/totp/confirm', { code: '000000' });
    await s.call('POST', '/api/totp/confirm', { code: codeOf(s, secret) });
    s.ctx.clock.t += 30_000;
    await s.call('POST', '/api/totp/remove', {
      password: 'secret1',
      code: codeOf(s, secret),
    });
    const rows = s.ctx.db
      .prepare(
        "SELECT category, action, actor, outcome, detail FROM audit_events WHERE action LIKE 'totp%' ORDER BY id",
      )
      .all();
    expect(rows).toEqual(
      [
        ['totpSetup', 'ok'],
        ['totpConfirm', 'rejected'],
        ['totpConfirm', 'ok'],
        ['totpRemove', 'ok'],
      ].map(([action, outcome]) => ({
        category: 'account',
        action,
        actor: 'u_Anna',
        outcome,
        detail: '{}',
      })),
    );
  });

  it('counts its requests against the limit of attempts', async () => {
    const s = await start({ cfg: { rateLimitAttempts: 1 } });
    addUser(s.ctx, 'Anna');
    const limited = { error: 'Zu viele Versuche – bitte später nochmal.' };
    // The first request of the address passes the guard, the second not.
    await s.call('POST', '/api/password/reset/check', { token: 'x' });
    for (const route of [
      '/api/password/reset/check',
      '/api/totp/setup',
      '/api/totp/confirm',
      '/api/totp/remove',
    ])
      expect((await s.call('POST', route, {})).json).toEqual(limited);
  });

  it('needs a session', async () => {
    const s = await anna();
    for (const route of ['setup', 'confirm', 'remove'])
      expect((await s.call('POST', `/api/totp/${route}`, {})).status).toBe(401);
  });
});

describe('the sign-in with the app (text 5, 102a)', () => {
  for (const emailLoginCodes of [true, false])
    it(`asks for the code of the app and sends no mail, codes ${emailLoginCodes ? 'on' : 'off'}`, async () => {
      const s = await anna({ emailLoginCodes });
      const secret = await withApp(s);
      s.mails.length = 0;
      const begun = await s.login();
      expect(begun.json).toEqual({ app: true });
      expect(begun.set).toMatch(/^nova_login=[\w-]{43}\.1; HttpOnly/);
      await tick();
      expect(s.mails).toEqual([]);
      expect((await s.call('GET', '/api/login/pending')).json).toEqual({
        pending: true,
        app: true,
      });
      // No way out by mail.
      s.ctx.clock.t += 30_000;
      expect((await s.call('POST', '/api/login/resend', {})).json).toEqual({
        error: emailLoginCodes
          ? MAIL_WRONG
          : 'Anmeldecodes sind nicht aktiviert.',
      });
      await tick();
      expect(s.mails).toEqual([]);
      const entered = await s.call('POST', '/api/login/code', {
        code: codeOf(s, secret),
      });
      expect(entered.json).toMatchObject({ ok: true });
      expect((await s.call('GET', '/api/state')).status).toBe(200);
    });

  it('refuses a code that signed in once, and a wrong password asks for nothing', async () => {
    const s = await anna();
    const secret = await withApp(s);
    expect((await s.login('wrong')).json).toEqual({
      error: expect.any(String),
    });
    await s.login();
    const code = codeOf(s, secret);
    await s.call('POST', '/api/login/code', { code });
    await s.call('POST', '/api/logout', {});
    await s.login();
    // The same step again: refused, though still in its window.
    expect((await s.call('POST', '/api/login/code', { code })).json).toEqual({
      error: WRONG,
    });
    // The next step signs in.
    expect(
      (
        await s.call('POST', '/api/login/code', {
          code: codeOf(s, secret, 1),
        })
      ).json,
    ).toMatchObject({ ok: true });
  });

  it('ends the sign-in after five wrong codes', async () => {
    const s = await anna();
    const secret = await withApp(s);
    await s.login();
    for (let i = 0; i < 5; i++)
      await s.call('POST', '/api/login/code', { code: '000000' });
    expect(
      (await s.call('POST', '/api/login/code', { code: codeOf(s, secret) }))
        .json,
    ).toEqual({ error: WRONG });
  });
});

describe('the removal of the app (text 4)', () => {
  it('asks for the password and a code of the app', async () => {
    const s = await anna();
    const secret = await withApp(s);
    await s.login();
    await s.call('POST', '/api/login/code', { code: codeOf(s, secret) });
    s.ctx.clock.t += 30_000;
    const remove = (password: string, code: string) =>
      s.call('POST', '/api/totp/remove', { password, code });
    expect((await remove('wrong', codeOf(s, secret))).json).toEqual({
      error: 'Das bisherige Passwort ist falsch.',
    });
    expect((await remove('secret1', '000000')).json).toEqual({
      error: WRONG,
    });
    expect((await remove('secret1', codeOf(s, secret))).json).toEqual({
      ok: true,
    });
    expect(
      ((await s.call('GET', '/api/state')).json as { me: { totp: boolean } }).me
        .totp,
    ).toBe(false);
    await s.call('POST', '/api/logout', {});
    // Without the app the sign-in is as before: here without codes.
    expect((await s.login()).json).toMatchObject({ ok: true });
  });

  it('refuses a removal without an app, a removal of a setup not confirmed, and one without a password', async () => {
    const s = await anna();
    await s.login();
    const remove = (body: object) => s.call('POST', '/api/totp/remove', body);
    expect(
      (await remove({ password: 'secret1', code: '000000' })).json,
    ).toEqual({ error: WRONG });
    const { secret } = (await s.call('POST', '/api/totp/setup', {})).json as {
      secret: string;
    };
    expect(
      (await remove({ password: 'secret1', code: codeOf(s, secret) })).json,
    ).toEqual({ error: WRONG });
    expect((await remove({ code: codeOf(s, secret) })).json).toEqual({
      error: 'Das bisherige Passwort ist falsch.',
    });
  });
});

describe('the reset of the admin (text 7, 103c)', () => {
  it('lets an admin reset the app of a player, audited, and no one else', async () => {
    const s = await anna({ emailLoginCodes: true });
    await withApp(s);
    addUser(s.ctx, 'Boss', { admin: true });
    addPlanet(s.ctx, 'u_Boss');
    s.cfg.emailLoginCodes = false;
    await s.call('POST', '/api/login', { name: 'Boss', password: 'secret1' });
    // The record of the player says whether an app is set up.
    const detail = async () =>
      (
        (await s.call('POST', '/api/admin/player', { player: 'u_Anna' }))
          .json as { totp: boolean }
      ).totp;
    expect(await detail()).toBe(true);
    const reset = await s.call('POST', '/api/admin/totp-reset', {
      player: 'u_Anna',
    });
    expect(reset.json).toEqual({ ok: true });
    expect(await detail()).toBe(false);
    expect(
      (await s.call('POST', '/api/admin/totp-reset', { player: 'nobody' }))
        .json,
    ).toEqual({ error: 'Spieler nicht gefunden.' });
    expect(
      s.ctx.db
        .prepare(
          "SELECT category, action, actor, target, outcome FROM audit_events WHERE action = 'totpReset' ORDER BY id",
        )
        .all(),
    ).toEqual([
      {
        category: 'admin.write',
        action: 'totpReset',
        actor: 'u_Boss',
        target: 'u_Anna',
        outcome: 'ok',
      },
      {
        category: 'admin.write',
        action: 'totpReset',
        actor: 'u_Boss',
        target: 'nobody',
        outcome: 'rejected',
      },
    ]);
    await s.call('POST', '/api/logout', {});
    // Anna signs in with the password and the mail code again.
    s.cfg.emailLoginCodes = true;
    expect((await s.login()).json).toEqual({ code: true });
    await s.call('POST', '/api/login/cancel', {});
    // A player is no admin.
    s.cfg.emailLoginCodes = false;
    await s.login();
    expect(
      (await s.call('POST', '/api/admin/totp-reset', { player: 'u_Boss' }))
        .json,
    ).toEqual({ error: 'Nur der Admin darf das.' });
  });
});

describe('„Passwort vergessen“ with the app (text 6, 104)', () => {
  /** The token of a reset link for Anna. */
  async function resetLink(s: Session): Promise<string> {
    s.mails.length = 0;
    await s.call('POST', '/api/password/forgot', { email: 'anna@example.org' });
    await tick();
    await tick();
    return /#reset=([\w-]{43})/.exec(s.mails[0]!.text)![1]!;
  }

  it('asks for the code of the app, counts a wrong one, and keeps the app', async () => {
    const s = await anna();
    const secret = await withApp(s);
    const token = await resetLink(s);
    expect(
      (await s.call('POST', '/api/password/reset/check', { token })).json,
    ).toEqual({ app: true });
    const reset = (code?: string, next = NEXT) =>
      s.call('POST', '/api/password/reset', { token, password: next, code });
    // The link alone sets no password.
    expect((await reset()).json).toEqual({ error: WRONG });
    expect((await reset('000000')).json).toEqual({ error: WRONG });
    // A password that would not be set takes no code.
    expect((await reset(codeOf(s, secret), 'kurz')).json).toEqual({
      error: expect.stringContaining('15'),
    });
    expect((await reset(codeOf(s, secret))).json).toEqual({ ok: true });
    // The app stays: the new password signs in with its code.
    s.ctx.clock.t += 30_000;
    expect((await s.login(NEXT)).json).toEqual({
      app: true,
    });
  });

  it('ends the link after five wrong codes', async () => {
    const s = await anna();
    const secret = await withApp(s);
    const token = await resetLink(s);
    for (let i = 0; i < 5; i++)
      await s.call('POST', '/api/password/reset', {
        token,
        password: NEXT,
        code: '000000',
      });
    expect(
      (
        await s.call('POST', '/api/password/reset', {
          token,
          password: NEXT,
          code: codeOf(s, secret),
        })
      ).json,
    ).toEqual({ error: 'Dieser Link ist ungültig oder abgelaufen.' });
    expect(
      (await s.call('POST', '/api/password/reset/check', { token })).json,
    ).toEqual({ app: false });
  });

  it('needs no code without an app', async () => {
    const s = await anna();
    const token = await resetLink(s);
    expect(
      (await s.call('POST', '/api/password/reset/check', { token })).json,
    ).toEqual({ app: false });
    expect(
      (
        await s.call('POST', '/api/password/reset', {
          token,
          password: NEXT,
        })
      ).json,
    ).toEqual({ ok: true });
  });
});

describe('the secret stays on the server (127a)', () => {
  it('is in no audit entry, error entry or state', async () => {
    const s = await anna();
    const secret = await withApp(s);
    await s.login();
    await s.call('POST', '/api/login/code', { code: '000000' });
    await s.call('POST', '/api/login/code', { code: codeOf(s, secret) });
    const dump = JSON.stringify([
      s.ctx.db.prepare('SELECT * FROM audit_events').all(),
      s.ctx.db.prepare('SELECT * FROM error_events').all(),
      (await s.call('GET', '/api/state')).json,
    ]);
    expect(dump).not.toContain(secret);
  });
});
