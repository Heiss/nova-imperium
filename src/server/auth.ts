// Accounts, sessions and invitations. Passwords are hashed with scrypt;
// session and invitation tokens are random and only their SHA-256 is stored.
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { Config } from './config.ts';
import type { Invitation, User } from './db/store.ts';
import { type Ctx, fail, int, str } from './game/context.ts';
import { placePlanet } from './game/planets.ts';

export const MIN_PASSWORD = 6;
export const MAX_PASSWORD = 200;
const DAY = 86400000;

export const hashPassword = (pw: string, salt: string): string =>
  scryptSync(pw, salt, 64).toString('hex');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const newToken = (): string => randomBytes(32).toString('base64url');

export function passwordMatches(u: User, pw: string): boolean {
  const a = Buffer.from(hashPassword(pw, u.salt), 'hex');
  const b = Buffer.from(u.pw, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ----- invitations -----

export const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export function inviteLink(cfg: Config, token: string): string {
  // The token is in the fragment: browsers never send it to a server or in a Referer.
  return `${cfg.publicUrl}/#invite=${token}`;
}

export interface NewInvitation {
  invitation: Invitation;
  link: string;
}

/** Creates an invitation; an open invitation for the same address is revoked. */
export function createInvitation(
  ctx: Ctx,
  cfg: Config,
  by: string | null,
  raw: unknown,
): NewInvitation {
  const email = str(raw, 254).toLowerCase();
  if (!EMAIL.test(email)) fail('Bitte eine gültige E-Mail-Adresse eingeben.');
  if (ctx.store.userByEmail(email))
    fail('Mit dieser Adresse spielt schon jemand.');
  const t = ctx.now();
  ctx.store.revokeInvitations({ email }, t);
  const token = newToken();
  const invitation: Invitation = {
    id: ctx.id(),
    email,
    tokenHash: hashToken(token),
    createdBy: by,
    created: t,
    expires: t + cfg.inviteDays * DAY,
    usedAt: null,
    revokedAt: null,
  };
  ctx.store.addInvitation(invitation);
  return { invitation, link: inviteLink(cfg, token) };
}

/** The open invitation of a token, or a message for the player. */
export function openInvitation(ctx: Ctx, token: unknown): Invitation {
  const inv = ctx.store.invitationByToken(hashToken(String(token ?? '')));
  const ok =
    inv &&
    inv.usedAt === null &&
    inv.revokedAt === null &&
    inv.expires > ctx.now();
  if (!ok) fail('Diese Einladung ist ungültig, abgelaufen oder schon benutzt.');
  return inv!;
}

// ----- accounts -----

export interface Registration {
  token: unknown;
  name: unknown;
  password: unknown;
  planet: unknown;
  gal: unknown;
}

function checkAccount(ctx: Ctx, name: string, pw: string): void {
  if (name.length < 2) fail('Der Name braucht mindestens 2 Zeichen.');
  if (pw.length < MIN_PASSWORD)
    fail(`Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`);
  if (pw.length > MAX_PASSWORD)
    fail(`Das Passwort darf höchstens ${MAX_PASSWORD} Zeichen haben.`);
  if (ctx.store.userByName(name)) fail('Der Name ist schon vergeben.');
}

/** Registers with an invitation. Nobody becomes admin here (see the CLI). */
export function register(ctx: Ctx, d: Registration): User {
  const inv = openInvitation(ctx, d.token);
  const name = str(d.name, 20);
  const pw = String(d.password ?? '');
  checkAccount(ctx, name, pw);
  if (ctx.store.userByEmail(inv.email))
    fail('Mit dieser Adresse spielt schon jemand.');
  const salt = randomBytes(16).toString('hex');
  const u: User = {
    id: 'u' + ctx.id(),
    name,
    email: inv.email,
    salt,
    pw: hashPassword(pw, salt),
    admin: false,
    probes: 1,
    readAt: ctx.now(),
    created: ctx.now(),
    research: {},
    rq: null,
  };
  ctx.store.saveUser(u);
  ctx.store.useInvitation(inv.id, ctx.now());
  const galaxies = ctx.store.universe().galaxies;
  placePlanet(
    ctx,
    u.id,
    str(d.planet, 20) || 'Heimatplanet',
    int(d.gal, 1, galaxies),
  );
  return u;
}

export function login(ctx: Ctx, name: unknown, password: unknown): User {
  const u = ctx.store.userByName(str(name, 20));
  if (!u || !passwordMatches(u, String(password ?? '')))
    fail('Name oder Passwort falsch.');
  return u!;
}

// ----- sessions -----

export function startSession(ctx: Ctx, cfg: Config, uid: string): string {
  const token = newToken();
  ctx.store.addSession(
    hashToken(token),
    uid,
    ctx.now() + cfg.sessionDays * DAY,
  );
  return token;
}

export function sessionUser(ctx: Ctx, token: string | undefined): User | null {
  if (!token) return null;
  const uid = ctx.store.sessionUser(hashToken(token), ctx.now());
  return uid ? ctx.store.user(uid) : null;
}

export function endSession(ctx: Ctx, token: string | undefined): void {
  if (token) ctx.store.deleteSession(hashToken(token));
}
