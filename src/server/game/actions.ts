// The actions of a player on their planet. Each one runs inside a transaction
// (see dispatch.ts) and saves what it changes.
import { BUILD, PRODUCERS, RES, UNIT } from '../../shared/catalog.ts';
import {
  afford,
  buildTime,
  lvlCost,
  maxAfford,
  pay,
  refund,
  reqMissing,
  researchTime,
  unitTime,
} from '../../shared/economy.ts';
import { settle, settleR } from '../../shared/settle.ts';
import type { Planet, ResearchState } from '../../shared/types.ts';
import type { AuditEntry } from '../audit.ts';
import {
  cancelScheduledPush,
  queuePush,
  scheduleShipyard,
} from '../push-store.ts';
import type { User } from '../db/store.ts';
import { type Ctx, fail, fmt, int, str, universe } from './context.ts';

export type Data = Record<string, unknown>;
export type Action = (
  ctx: Ctx,
  u: User,
  d: Data,
  event?: AuditEntry,
) => string | null;

export const MAX_SHIPYARD_ORDERS = 20;

/** The home planet of the player, moved forward to now. */
export function mine(ctx: Ctx, u: User): Planet {
  const p = ctx.store.planetOfUser(u.id) ?? fail('Du hast keinen Planeten.');
  return settle(p, ctx.now(), universe(ctx));
}

export const researchOf = (ctx: Ctx, u: User): ResearchState =>
  settleR(u, ctx.now());

function setResearch(ctx: Ctx, u: User, r: ResearchState): void {
  u.research = r.research;
  u.rq = r.rq;
  ctx.store.saveUser(u);
}

const checkBuild = (p: Planet, r: ResearchState, k: string): void => {
  if (p.bq) fail('Es wird bereits gebaut.');
  if (reqMissing(BUILD[k]!, p, r).length) fail('Voraussetzungen fehlen.');
  if (k === 'yard' && p.sq.length) fail('Die Werft arbeitet gerade.');
  if (k === 'lab' && r.rq) fail('Das Labor forscht gerade.');
};

export const build: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = BUILD[k] ?? fail('Unbekanntes Gebäude.');
  const p = mine(ctx, u);
  checkBuild(p, researchOf(ctx, u), k);
  const lvl = (p.b[k] ?? 0) + 1;
  const c = lvlCost(def, lvl);
  if (!afford(p, c)) fail('Nicht genug Rohstoffe.');
  pay(p, c);
  const t = ctx.now();
  p.bq = {
    key: k,
    lvl,
    start: t,
    end: t + buildTime(c, p, universe(ctx)),
    cost: c,
  };
  ctx.store.savePlanet(p);
  if (event) event.detail = { planet: p.id, key: k, level: lvl, due: p.bq.end };
  queuePush(ctx, u.id, 'buildings', String(t), p.bq.end);
  return null;
};

export const cancelBuild: Action = (ctx, u) => {
  const p = mine(ctx, u);
  if (!p.bq) return null;
  refund(p, p.bq.cost);
  p.bq = null;
  cancelScheduledPush(ctx, u.id, 'buildings');
  ctx.store.savePlanet(p);
  return null;
};

const checkResearch = (p: Planet, r: ResearchState, k: string): void => {
  if (!((p.b.lab ?? 0) > 0)) fail('Du brauchst ein Forschungslabor.');
  if (r.rq) fail('Es wird bereits geforscht.');
  if (p.bq?.key === 'lab') fail('Das Labor wird ausgebaut.');
  if (reqMissing(RES[k]!, p, r).length) fail('Voraussetzungen fehlen.');
};

export const research: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = RES[k] ?? fail('Unbekannte Forschung.');
  const p = mine(ctx, u);
  const r = researchOf(ctx, u);
  checkResearch(p, r, k);
  const lvl = (r.research[k] ?? 0) + 1;
  const c = lvlCost(def, lvl);
  if (!afford(p, c)) fail('Nicht genug Rohstoffe.');
  pay(p, c);
  const t = ctx.now();
  r.rq = {
    key: k,
    lvl,
    start: t,
    end: t + researchTime(c, p, universe(ctx)),
    cost: c,
  };
  setResearch(ctx, u, r);
  ctx.store.savePlanet(p);
  if (event) event.detail = { planet: p.id, key: k, level: lvl, due: r.rq.end };
  queuePush(ctx, u.id, 'research', String(t), r.rq.end);
  return null;
};

export const cancelResearch: Action = (ctx, u) => {
  const p = mine(ctx, u);
  const r = researchOf(ctx, u);
  if (!r.rq) return null;
  refund(p, r.rq.cost);
  r.rq = null;
  cancelScheduledPush(ctx, u.id, 'research');
  setResearch(ctx, u, r);
  ctx.store.savePlanet(p);
  return null;
};

function requireYard(p: Planet): void {
  if (!((p.b.yard ?? 0) > 0)) fail('Du brauchst eine Raumschiffwerft.');
  if (p.bq?.key === 'yard') fail('Die Werft wird ausgebaut.');
}

export const order: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = UNIT[k] ?? fail('Unbekannte Einheit.');
  const p = mine(ctx, u);
  requireYard(p);
  if (reqMissing(def, p, researchOf(ctx, u)).length)
    fail('Voraussetzungen fehlen.');
  const n = Math.min(int(d.n, 0, 1e9), maxAfford(p, def.cost));
  if (n <= 0) fail('Nicht genug Rohstoffe.');
  if (p.sq.length >= MAX_SHIPYARD_ORDERS)
    fail('Die Bauliste der Werft ist voll.');
  pay(p, def.cost, n);
  if (!p.sq.length) p.sqT = ctx.now();
  p.sq.push({ key: k, n, unit: unitTime(def, p, universe(ctx)) });
  ctx.store.savePlanet(p);
  if (event) event.detail = { planet: p.id, key: k, units: n };
  scheduleShipyard(ctx, u.id, p.sqT!, p.sq);
  return `${fmt(n)}× ${def.n} in Auftrag gegeben.`;
};

export const pct: Action = (ctx, u, d) => {
  const k = String(d.key);
  if (!(PRODUCERS as readonly string[]).includes(k)) fail('Ungültig.');
  const p = mine(ctx, u);
  p.pct[k] = Math.round(int(d.v, 0, 100) / 10) * 10;
  ctx.store.savePlanet(p);
  return null;
};

export const rename: Action = (ctx, u, d) => {
  const n = str(d.name, 20);
  if (!n) fail('Bitte einen Namen eingeben.');
  const p = mine(ctx, u);
  p.name = n;
  ctx.store.savePlanet(p);
  return null;
};

export const options: Action = (ctx, u, d) => {
  u.probes = int(d.probes, 1, 1e6);
  ctx.store.saveUser(u);
  return 'Gespeichert.';
};

export const read: Action = (ctx, u) => {
  u.readAt = Math.max(0, ...ctx.store.reports(u.id).map((r) => r.time));
  ctx.store.saveUser(u);
  return null;
};

export const delrep: Action = (ctx, u, d) => {
  ctx.store.deleteReport(u.id, String(d.id));
  return null;
};

export const delall: Action = (ctx, u) => {
  ctx.store.deleteReports(u.id);
  return null;
};
