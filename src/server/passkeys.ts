import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { hashToken, newToken, passwordMatches } from './auth.ts';
import type { Config } from './config.ts';
import type { User } from './db/store.ts';
import { type Ctx, fail } from './game/context.ts';

const TTL = 5 * 60000;
const INVALID =
  'Passkey konnte nicht bestätigt werden. Bitte erneut versuchen.';

function relyingParty(cfg: Config) {
  const url = new URL(cfg.publicUrl);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost')
    fail('Passkeys benötigen HTTPS.');
  return { origin: url.origin, rpID: url.hostname };
}

function issue(ctx: Ctx, challenge: string, token?: string): string {
  const id = newToken();
  ctx.store.db
    .prepare('INSERT INTO passkey_challenges VALUES (?, ?, ?, ?)')
    .run(
      hashToken(id),
      challenge,
      token ? hashToken(token) : null,
      ctx.now() + TTL,
    );
  return id;
}

function consume(ctx: Ctx, id: unknown, token?: string): string {
  if (typeof id !== 'string' || id.length !== 43) return fail(INVALID);
  const row = ctx.store.db
    .prepare(
      `
    DELETE FROM passkey_challenges WHERE id = ? AND session_hash IS ?
      AND expires > ? RETURNING challenge
  `,
    )
    .get(hashToken(id), token ? hashToken(token) : null, ctx.now()) as
    { challenge: string } | undefined;
  return row?.challenge ?? fail(INVALID);
}

export function purgePasskeyChallenges(ctx: Ctx): void {
  ctx.store.db
    .prepare('DELETE FROM passkey_challenges WHERE expires <= ?')
    .run(ctx.now());
}

export function passkeysOf(ctx: Ctx, user: User) {
  return ctx.store.db
    .prepare(
      'SELECT id, created FROM passkeys WHERE user_id = ? ORDER BY created',
    )
    .all(user.id) as { id: string; created: number }[];
}

export async function registerPasskeyOptions(
  ctx: Ctx,
  cfg: Config,
  user: User,
  token: string,
  password: unknown,
) {
  if (typeof password !== 'string' || !passwordMatches(user, password))
    fail('Das bisherige Passwort ist falsch.');
  const { rpID } = relyingParty(cfg);
  const options = await generateRegistrationOptions({
    rpName: 'Nova Imperium',
    rpID,
    userName: user.name,
    userID: Buffer.from(user.id),
    excludeCredentials: passkeysOf(ctx, user).map(({ id }) => ({ id })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });
  return { options, ceremony: issue(ctx, options.challenge, token) };
}

export async function registerPasskey(
  ctx: Ctx,
  cfg: Config,
  user: User,
  token: string,
  body: Record<string, unknown>,
) {
  const { origin, rpID } = relyingParty(cfg);
  const challenge = consume(ctx, body.ceremony, token);
  const result = await verifyRegistrationResponse({
    response: body.response as RegistrationResponseJSON,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => fail(INVALID));
  const credential = result.registrationInfo?.credential;
  if (!result.verified || !credential) return fail(INVALID);
  if (ctx.store.sessionUser(hashToken(token), ctx.now()) !== user.id)
    return fail(INVALID);
  const saved = ctx.store.db
    .prepare('INSERT OR IGNORE INTO passkeys VALUES (?, ?, ?, ?, ?)')
    .run(
      credential.id,
      user.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      ctx.now(),
    );
  if (!saved.changes) fail('Dieser Passkey ist bereits hinterlegt.');
}

export async function passkeyLoginOptions(ctx: Ctx, cfg: Config) {
  const { rpID } = relyingParty(cfg);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
  });
  return { options, ceremony: issue(ctx, options.challenge) };
}

interface StoredKey {
  id: string;
  user_id: string;
  public_key: Buffer;
  counter: number;
}

function credentialOf(
  ctx: Ctx,
  response: AuthenticationResponseJSON | undefined,
): StoredKey {
  if (typeof response?.id !== 'string') return fail(INVALID);
  const row = ctx.store.db
    .prepare('SELECT * FROM passkeys WHERE id = ?')
    .get(response.id) as StoredKey | undefined;
  if (
    !row ||
    response.response?.userHandle !==
      Buffer.from(row.user_id).toString('base64url')
  )
    return fail(INVALID);
  return row;
}

export async function verifyPasskeyLogin(
  ctx: Ctx,
  cfg: Config,
  body: Record<string, unknown>,
): Promise<User> {
  const { origin, rpID } = relyingParty(cfg);
  const challenge = consume(ctx, body.ceremony);
  const response = body.response as AuthenticationResponseJSON;
  const key = credentialOf(ctx, response);
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: key.id,
      publicKey: Uint8Array.from(key.public_key),
      counter: key.counter,
    },
    requireUserVerification: true,
  }).catch(() => fail(INVALID));
  if (!result.verified) return fail(INVALID);
  const updated = ctx.store.db
    .prepare('UPDATE passkeys SET counter = ? WHERE id = ? AND counter = ?')
    .run(result.authenticationInfo.newCounter, key.id, key.counter);
  if (!updated.changes) return fail(INVALID);
  return ctx.store.user(key.user_id) ?? fail(INVALID);
}

export function removePasskey(ctx: Ctx, user: User, id: unknown): void {
  if (typeof id !== 'string') return fail('Passkey nicht gefunden.');
  if (
    !ctx.store.db
      .prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?')
      .run(id, user.id).changes
  )
    fail('Passkey nicht gefunden.');
}
