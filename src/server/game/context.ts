// What the game logic needs from outside: the store, the clock, chance and ids.
// Tests pass a fixed clock and a seeded generator.
import { randomBytes } from 'node:crypto';
import type { Rng } from '../../shared/battle.ts';
import type { Coords, Resources, Universe } from '../../shared/types.ts';
import type { Report, Store } from '../db/store.ts';
import { queuePush, type PushKind } from '../push-store.ts';

export interface Ctx {
  store: Store;
  now: () => number;
  rng: Rng;
  id: () => string;
}

export const randomId = (): string => randomBytes(9).toString('base64url');

export function createCtx(
  store: Store,
  over: Partial<Omit<Ctx, 'store'>> = {},
): Ctx {
  return { store, now: Date.now, rng: Math.random, id: randomId, ...over };
}

/** A mistake of the player: the message is shown to them. */
export class GameError extends Error {}

export const fail = (message: string): never => {
  throw new GameError(message);
};

export const universe = (ctx: Ctx): Universe => ctx.store.universe();

export const int = (v: unknown, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
export const str = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(CONTROL, '')
    .trim()
    .slice(0, max);

export const coords = (c: Coords): string => `[${c.g}:${c.s}:${c.p}]`;
export const fmt = (n: number): string =>
  Math.floor(n || 0).toLocaleString('de-DE');
export const resLine = (r: Resources): string =>
  `Metall ${fmt(r.m)} · Kristall ${fmt(r.c)} · Deuterium ${fmt(r.d)}`;

export type ReportInput = Pick<Report, 'time' | 'type' | 'title'> &
  Record<string, unknown>;

export function addReport(
  ctx: Ctx,
  uid: string,
  report: ReportInput,
  kind: PushKind = 'messages',
): void {
  if (!ctx.store.user(uid)) return;
  const id = ctx.id();
  ctx.store.addReport(
    uid,
    { ...report, id } as Report,
    universe(ctx).maxReports,
  );
  queuePush(ctx, uid, kind, id, ctx.now());
}
