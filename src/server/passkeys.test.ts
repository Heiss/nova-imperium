// Passkeys with the WebAuthn verification replaced: the library's own checks
// are its tests; here every rule of ours around it is checked on its own.
import * as webauthn from '@simplewebauthn/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashToken, newToken } from './auth.ts';
import { GameError } from './game/context.ts';
import {
  passkeyLoginOptions,
  passkeysOf,
  purgePasskeyChallenges,
  registerPasskey,
  registerPasskeyOptions,
  removePasskey,
  verifyPasskeyLogin,
} from './passkeys.ts';
import { addUser, testConfig, testCtx } from './test-helpers.ts';

vi.mock('@simplewebauthn/server', async (original) => ({
  ...(await original<typeof import('@simplewebauthn/server')>()),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

const verifyRegistration = vi.mocked(webauthn.verifyRegistrationResponse);
const verifyAuthentication = vi.mocked(webauthn.verifyAuthenticationResponse);
const INVALID = new GameError(
  'Passkey konnte nicht bestätigt werden. Bitte erneut versuchen.',
);
const TTL = 5 * 60000;
const cfg = testConfig({ publicUrl: 'https://nova.example.org' });

afterEach(() => vi.resetAllMocks());

function setup() {
  const ctx = testCtx();
  const user = addUser(ctx, 'Anna');
  const token = newToken();
  ctx.players.addSession(hashToken(token), user.id, ctx.now() + 9e9);
  const challenges = () =>
    ctx.db
      .prepare(
        'SELECT challenge, session_hash, expires FROM passkey_challenges',
      )
      .all() as {
      challenge: string;
      session_hash: string | null;
      expires: number;
    }[];
  return { ctx, user, token, challenges };
}

const registered = (id = 'cred-1', counter = 3) =>
  ({
    verified: true,
    registrationInfo: {
      credential: { id, publicKey: new Uint8Array([1, 2, 3]), counter },
    },
  }) as unknown as Awaited<ReturnType<typeof verifyRegistration>>;

const authenticated = (verified: boolean, newCounter = 4) =>
  ({
    verified,
    authenticationInfo: { newCounter },
  }) as unknown as Awaited<ReturnType<typeof verifyAuthentication>>;

async function withPasskey() {
  const s = setup();
  const { ceremony } = await registerPasskeyOptions(
    s.ctx,
    cfg,
    s.user,
    s.token,
    'secret1',
  );
  verifyRegistration.mockResolvedValue(registered());
  await registerPasskey(s.ctx, cfg, s.user, s.token, {
    ceremony,
    response: {},
  });
  return s;
}

const loginBody = (ceremony: string, userId: string, id = 'cred-1') => ({
  ceremony,
  response: {
    id,
    response: { userHandle: Buffer.from(userId).toString('base64url') },
  },
});

describe('relying party', () => {
  it('needs HTTPS except on localhost', async () => {
    const { ctx } = setup();
    for (const publicUrl of [
      'http://nova.example.org',
      'http://127.0.0.1:8080',
    ])
      await expect(
        passkeyLoginOptions(ctx, testConfig({ publicUrl })),
      ).rejects.toThrow(new GameError('Passkeys benötigen HTTPS.'));
    const local = await passkeyLoginOptions(
      ctx,
      testConfig({ publicUrl: 'http://localhost:8080' }),
    );
    expect(local.options.rpId).toBe('localhost');
    const remote = await passkeyLoginOptions(ctx, cfg);
    expect(remote.options).toMatchObject({
      rpId: 'nova.example.org',
      userVerification: 'required',
    });
  });
});

describe('passkey registration', () => {
  it('needs the current password', async () => {
    const { ctx, user, token, challenges } = setup();
    for (const password of ['wrong', undefined, 7])
      await expect(
        registerPasskeyOptions(ctx, cfg, user, token, password),
      ).rejects.toThrow(new GameError('Das bisherige Passwort ist falsch.'));
    expect(challenges()).toEqual([]);
  });

  it('asks for a resident key with user verification and excludes known keys', async () => {
    const { ctx, user, token, challenges } = await withPasskey();
    const { options, ceremony } = await registerPasskeyOptions(
      ctx,
      cfg,
      user,
      token,
      'secret1',
    );
    expect(options).toMatchObject({
      rp: { name: 'Nova Imperium', id: 'nova.example.org' },
      user: {
        name: 'Anna',
        id: Buffer.from(user.id).toString('base64url'),
      },
      excludeCredentials: [expect.objectContaining({ id: 'cred-1' })],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
    });
    expect(ceremony).toHaveLength(43);
    expect(challenges()).toEqual([
      {
        challenge: options.challenge,
        session_hash: hashToken(token),
        expires: ctx.now() + TTL,
      },
    ]);
  });

  it('stores a verified key once, bound to the session that asked', async () => {
    const { ctx, user, token, challenges } = setup();
    const { options, ceremony } = await registerPasskeyOptions(
      ctx,
      cfg,
      user,
      token,
      'secret1',
    );
    verifyRegistration.mockResolvedValue(registered('cred-9', 7));
    await registerPasskey(ctx, cfg, user, token, { ceremony, response: {} });
    expect(verifyRegistration).toHaveBeenCalledWith({
      response: {},
      expectedChallenge: options.challenge,
      expectedOrigin: 'https://nova.example.org',
      expectedRPID: 'nova.example.org',
      requireUserVerification: true,
    });
    expect(ctx.db.prepare('SELECT * FROM passkeys').all()).toEqual([
      {
        id: 'cred-9',
        user_id: user.id,
        public_key: Buffer.from([1, 2, 3]),
        counter: 7,
        created: ctx.now(),
      },
    ]);
    expect(challenges()).toEqual([]);
    await expect(
      registerPasskey(ctx, cfg, user, token, { ceremony, response: {} }),
    ).rejects.toThrow(INVALID);
  });

  it('refuses a ceremony of another session, a late one and a malformed one', async () => {
    const { ctx, user, token } = setup();
    verifyRegistration.mockResolvedValue(registered());
    const ask = async () =>
      (await registerPasskeyOptions(ctx, cfg, user, token, 'secret1')).ceremony;
    const other = newToken();
    ctx.players.addSession(hashToken(other), user.id, ctx.now() + 9e9);
    const first = await ask();
    await expect(
      registerPasskey(ctx, cfg, user, other, { ceremony: first }),
    ).rejects.toThrow(INVALID);
    const late = await ask();
    ctx.clock.t += TTL;
    await expect(
      registerPasskey(ctx, cfg, user, token, { ceremony: late }),
    ).rejects.toThrow(INVALID);
    for (const ceremony of [undefined, 42, 'x'.repeat(42), `${first}x`])
      await expect(
        registerPasskey(ctx, cfg, user, token, { ceremony }),
      ).rejects.toThrow(INVALID);
    ctx.clock.t -= 1;
    await registerPasskey(ctx, cfg, user, token, { ceremony: first });
    expect(passkeysOf(ctx, user)).toHaveLength(1);
  });

  it('refuses unverified answers, missing credentials and a session that ended', async () => {
    const { ctx, user, token } = setup();
    const ask = async () =>
      (await registerPasskeyOptions(ctx, cfg, user, token, 'secret1')).ceremony;
    const answers = [
      () => verifyRegistration.mockRejectedValueOnce(new Error('bad')),
      () =>
        verifyRegistration.mockResolvedValueOnce({
          ...registered(),
          verified: false,
        } as unknown as Awaited<ReturnType<typeof verifyRegistration>>),
      () =>
        verifyRegistration.mockResolvedValueOnce({
          verified: true,
          registrationInfo: undefined,
        } as unknown as Awaited<ReturnType<typeof verifyRegistration>>),
    ];
    for (const answer of answers) {
      answer();
      await expect(
        registerPasskey(ctx, cfg, user, token, { ceremony: await ask() }),
      ).rejects.toThrow(INVALID);
    }
    const ceremony = await ask();
    verifyRegistration.mockImplementationOnce(async () => {
      ctx.players.deleteSession(hashToken(token));
      return registered();
    });
    await expect(
      registerPasskey(ctx, cfg, user, token, { ceremony }),
    ).rejects.toThrow(INVALID);
    expect(passkeysOf(ctx, user)).toEqual([]);
  });

  it('names a key that is already stored', async () => {
    const { ctx, user, token } = await withPasskey();
    const { ceremony } = await registerPasskeyOptions(
      ctx,
      cfg,
      user,
      token,
      'secret1',
    );
    verifyRegistration.mockResolvedValue(registered());
    await expect(
      registerPasskey(ctx, cfg, user, token, { ceremony, response: {} }),
    ).rejects.toThrow(new GameError('Dieser Passkey ist bereits hinterlegt.'));
  });
});

describe('passkey login', () => {
  it('logs in with a verified key and moves its counter on', async () => {
    const { ctx, user, challenges } = await withPasskey();
    const { options, ceremony } = await passkeyLoginOptions(ctx, cfg);
    expect(challenges()).toEqual([
      {
        challenge: options.challenge,
        session_hash: null,
        expires: ctx.now() + TTL,
      },
    ]);
    verifyAuthentication.mockResolvedValue(authenticated(true, 9));
    const body = loginBody(ceremony, user.id);
    expect((await verifyPasskeyLogin(ctx, cfg, body)).id).toBe(user.id);
    expect(verifyAuthentication).toHaveBeenCalledWith({
      response: body.response,
      expectedChallenge: options.challenge,
      expectedOrigin: 'https://nova.example.org',
      expectedRPID: 'nova.example.org',
      credential: {
        id: 'cred-1',
        publicKey: Uint8Array.from([1, 2, 3]),
        counter: 3,
      },
      requireUserVerification: true,
    });
    expect(ctx.db.prepare('SELECT counter FROM passkeys').get()).toEqual({
      counter: 9,
    });
    await expect(verifyPasskeyLogin(ctx, cfg, body)).rejects.toThrow(INVALID);
  });

  it('refuses a missing, unknown or foreign key and an unverified answer', async () => {
    const { ctx, user } = await withPasskey();
    verifyAuthentication.mockResolvedValue(authenticated(true));
    const ask = async () => (await passkeyLoginOptions(ctx, cfg)).ceremony;
    const bodies = [
      async () => ({ ceremony: await ask(), response: undefined }),
      async () => ({ ceremony: await ask(), response: { id: 7 } }),
      async () => loginBody(await ask(), user.id, 'cred-unknown'),
      async () => loginBody(await ask(), 'u_Other'),
      async () => ({
        ceremony: await ask(),
        response: { id: 'cred-1' },
      }),
    ];
    for (const body of bodies)
      await expect(verifyPasskeyLogin(ctx, cfg, await body())).rejects.toThrow(
        INVALID,
      );
    verifyAuthentication.mockResolvedValueOnce(authenticated(false));
    await expect(
      verifyPasskeyLogin(ctx, cfg, loginBody(await ask(), user.id)),
    ).rejects.toThrow(INVALID);
    verifyAuthentication.mockRejectedValueOnce(new Error('bad'));
    await expect(
      verifyPasskeyLogin(ctx, cfg, loginBody(await ask(), user.id)),
    ).rejects.toThrow(INVALID);
    expect(ctx.db.prepare('SELECT counter FROM passkeys').get()).toEqual({
      counter: 3,
    });
  });

  it('refuses a second login that used the same counter at the same time', async () => {
    const { ctx, user } = await withPasskey();
    const { ceremony } = await passkeyLoginOptions(ctx, cfg);
    verifyAuthentication.mockImplementationOnce(async () => {
      ctx.db.prepare('UPDATE passkeys SET counter = 5').run();
      return authenticated(true, 4);
    });
    await expect(
      verifyPasskeyLogin(ctx, cfg, loginBody(ceremony, user.id)),
    ).rejects.toThrow(INVALID);
  });
});

describe('passkey list and removal', () => {
  it('lists keys oldest first and removes only own ones', async () => {
    const { ctx, user } = setup();
    const other = addUser(ctx, 'Other');
    const insert = ctx.db.prepare(
      "INSERT INTO passkeys VALUES (?, ?, x'00', 0, ?)",
    );
    insert.run('new', user.id, 20);
    insert.run('old', user.id, 10);
    insert.run('theirs', other.id, 5);
    expect(passkeysOf(ctx, user)).toEqual([
      { id: 'old', created: 10 },
      { id: 'new', created: 20 },
    ]);
    for (const id of [undefined, 7, 'theirs', 'missing'])
      expect(() => removePasskey(ctx, user, id)).toThrow(
        new GameError('Passkey nicht gefunden.'),
      );
    removePasskey(ctx, user, 'old');
    expect(passkeysOf(ctx, user)).toEqual([{ id: 'new', created: 20 }]);
    expect(passkeysOf(ctx, other)).toHaveLength(1);
  });

  it('purges challenges at their expiry', async () => {
    const { ctx, challenges } = setup();
    await passkeyLoginOptions(ctx, cfg);
    ctx.clock.t += TTL - 1;
    purgePasskeyChallenges(ctx);
    expect(challenges()).toHaveLength(1);
    ctx.clock.t += 1;
    purgePasskeyChallenges(ctx);
    expect(challenges()).toEqual([]);
  });
});
