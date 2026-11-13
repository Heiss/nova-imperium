// What the game logic needs from outside: the repositories with their unit of
// work, the clock, chance and ids. Tests pass a fixed clock and a seeded
// generator.
import { randomBytes } from 'node:crypto';
import type { Rng } from '../../core/battle.ts';
import type { Coords, Resources, Universe } from '../../core/types.ts';
import type { Db } from '../db/database.ts';
import type { Repositories } from '../db/repos/index.ts';
import type { Report } from '../db/repos/reports.ts';
import type { Store } from '../db/store.ts';
import { queuePush, type PushKind } from '../push-store.ts';

export interface Ctx extends Repositories {
  /** The unit of work: one immediate SQLite transaction. Repositories never open one. */
  tx: <T>(fn: () => T) => T;
  /** For the SQL that has no repository yet (#117). */
  db: Db;
  now: () => number;
  rng: Rng;
  id: () => string;
}

const randomId = (): string => randomBytes(9).toString('base64url');

export function createCtx(
  store: Store,
  over: Partial<Pick<Ctx, 'now' | 'rng' | 'id'>> = {},
): Ctx {
  return {
    ...store.repos,
    db: store.db,
    tx: (fn) => store.tx(fn),
    now: Date.now,
    rng: Math.random,
    id: randomId,
    ...over,
  };
}

/** A mistake of the player: the message is shown to them. */
export class GameError extends Error {}

export const fail = (message: string): never => {
  throw new GameError(message);
};

export const universe = (ctx: Ctx): Universe => ctx.admin.universe();

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
  `Adamant ${fmt(r.m)} · Psikristall ${fmt(r.c)} · Promethium ${fmt(r.d)}`;

export type ReportInput = Pick<Report, 'time' | 'type' | 'title'> &
  Record<string, unknown>;

export function addReport(
  ctx: Ctx,
  uid: string,
  report: ReportInput,
  kind: PushKind = 'messages',
  pushBody: string | null = null,
): void {
  if (!ctx.players.get(uid)) return;
  const id = ctx.id();
  ctx.reports.add(uid, { ...report, id } as Report, universe(ctx).maxReports);
  queuePush(ctx, uid, kind, id, ctx.now(), pushBody);
}
