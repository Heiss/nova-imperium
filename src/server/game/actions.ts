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
import { type ExplainMode, isExplainMode } from '../../shared/explain.ts';
import { labUpgrading, waitsForLab } from '../../shared/lab.ts';
import {
  energyNeed,
  energyShort,
  type LabSite,
  labSite,
  networkLab,
} from '../../shared/research.ts';
import { settle, settleR } from '../../shared/settle.ts';
import { waitsForYard, YARD_LOCK, yardLockedBy } from '../../shared/yard.ts';
import type { Cost, Planet, Queue, ResearchState } from '../../shared/types.ts';
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

const MAX_SHIPYARD_ORDERS = 20;

/** The selected planet, or the home planet for callers without a selection. */
export function mine(ctx: Ctx, u: User, id?: unknown): Planet {
  const p =
    id === undefined
      ? ctx.store.planetOfUser(u.id)
      : ctx.store.planet(String(id));
  if (!p || p.owner !== u.id)
    return fail(
      id === undefined
        ? 'Du hast keinen Planeten.'
        : 'Du hast keinen Zugriff auf diesen Planeten.',
    );
  return settle(p, ctx.now(), universe(ctx), u);
}

export const researchOf = (ctx: Ctx, u: User): ResearchState =>
  settleR(u, ctx.now());

/**
 * The stored research forgets when Energietechnik finished once a new
 * research starts. The planets with a Fusionskraftwerk take that end into
 * their production first (#47), so it does not matter when they are settled.
 */
function settleReactors(ctx: Ctx, u: User): void {
  if (u.rq?.key !== 'energy' || u.rq.end > ctx.now()) return;
  for (const x of ctx.store.playerPlanets(u.id))
    if ((x.b.fusion ?? 0) > 0 || x.bq?.key === 'fusion')
      ctx.store.savePlanet(settle(x, ctx.now(), universe(ctx), u));
}

function setResearch(ctx: Ctx, u: User, r: ResearchState): void {
  settleReactors(ctx, u);
  u.research = r.research;
  u.rq = r.rq;
  ctx.store.saveUser(u);
}

const checkBuild = (p: Planet, r: ResearchState, k: string): void => {
  if (p.bq) fail('Es wird bereits gebaut.');
  if (reqMissing(BUILD[k]!, p, r).length) fail('Voraussetzungen fehlen.');
  if (waitsForYard(p, k)) fail('Die Werft arbeitet gerade.');
  if (waitsForLab(r, k)) fail('Das Labor forscht gerade.');
};

/**
 * Pays the next level of `def` on `p` and returns its queue entry; the audit
 * event gets the planet, key, level and due time.
 */
function payNextLevel(
  ctx: Ctx,
  p: Planet,
  next: { def: { cost: Cost; f?: number }; key: string; have: number },
  time: (c: Cost) => number,
  event: AuditEntry | undefined,
): Queue {
  const lvl = next.have + 1;
  const cost = lvlCost(next.def, lvl);
  if (!afford(p, cost)) fail('Nicht genug Rohstoffe.');
  pay(p, cost);
  const start = ctx.now();
  const q = { key: next.key, lvl, start, end: start + time(cost), cost };
  if (event)
    event.detail = { planet: p.id, key: q.key, level: lvl, due: q.end };
  return q;
}

export const build: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = BUILD[k] ?? fail('Unbekanntes Gebäude.');
  // „at“: a requirement on another own planet (issue #64); the answer keeps
  // showing d.planet.
  const p = mine(ctx, u, d.at ?? d.planet);
  checkBuild(p, researchOf(ctx, u), k);
  const q = payNextLevel(
    ctx,
    p,
    { def, key: k, have: p.b[k] ?? 0 },
    (c) => buildTime(c, p, universe(ctx)),
    event,
  );
  p.bq = q;
  ctx.store.savePlanet(p);
  queuePush(ctx, u.id, 'buildings', `${p.id}:${q.start}`, q.end);
  return null;
};

export const cancelBuild: Action = (ctx, u, d) => {
  const p = mine(ctx, u, d.planet);
  if (!p.bq) return null;
  refund(p, p.bq.cost);
  cancelScheduledPush(ctx, u.id, 'buildings', `${p.id}:${p.bq.start}`);
  p.bq = null;
  ctx.store.savePlanet(p);
  return null;
};

const checkResearch = (p: Planet, r: ResearchState, k: string): void => {
  if (!((p.b.lab ?? 0) > 0)) fail('Du brauchst ein Forschungslabor.');
  if (r.rq) fail('Es wird bereits geforscht.');
  if (labUpgrading(p)) fail('Das Labor wird ausgebaut.');
  if (reqMissing(RES[k]!, p, r).length) fail('Voraussetzungen fehlen.');
};

/** Gravitonforschung: the starting planet must produce enough energy (#49). */
function checkEnergy(ctx: Ctx, p: Planet, r: ResearchState, k: string): void {
  const def = RES[k]!;
  const level = (r.research[k] ?? 0) + 1;
  const short = energyShort(def, level, p, universe(ctx), r.research);
  if (short > 0)
    fail(
      `Zu wenig Energie: ${def.n} braucht eine Energieproduktion von ${fmt(energyNeed(def, level))}, es fehlen ${fmt(short)}.`,
    );
}

/** The labs of all own planets, moved to now, for the research network (#49). */
export const ownLabs = (ctx: Ctx, uid: string): LabSite[] =>
  ctx.store
    .playerPlanets(uid)
    .map((x) => labSite(settle(x, ctx.now(), universe(ctx))));

/** Starts research on the selected own planet, which pays it (#49). */
export const research: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = RES[k] ?? fail('Unbekannte Forschung.');
  const p = mine(ctx, u, d.planet);
  const r = researchOf(ctx, u);
  const have = r.research[k] ?? 0;
  checkResearch(p, r, k);
  checkEnergy(ctx, p, r, k);
  const lab = networkLab(
    k,
    labSite(p),
    ownLabs(ctx, u.id),
    r.research.ifn ?? 0,
  );
  const q = payNextLevel(
    ctx,
    p,
    { def, key: k, have },
    (c) => researchTime(c, { b: { lab } }, universe(ctx)),
    event,
  );
  r.rq = { ...q, planet: p.id };
  setResearch(ctx, u, r);
  ctx.store.savePlanet(p);
  queuePush(ctx, u.id, 'research', String(q.start), q.end);
  return null;
};

/** Refunds the planet where the research started (the home planet before #49). */
export const cancelResearch: Action = (ctx, u) => {
  const r = researchOf(ctx, u);
  if (!r.rq) return null;
  const p = mine(ctx, u, r.rq.planet);
  refund(p, r.rq.cost);
  r.rq = null;
  cancelScheduledPush(ctx, u.id, 'research');
  setResearch(ctx, u, r);
  ctx.store.savePlanet(p);
  return null;
};

function requireYard(p: Planet): void {
  if (!((p.b.yard ?? 0) > 0)) fail('Du brauchst eine Raumschiffwerft.');
  const lock = yardLockedBy(p);
  if (lock) fail(`Die ${YARD_LOCK[lock]} wird ausgebaut.`);
}

export const order: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = UNIT[k] ?? fail('Unbekannte Einheit.');
  const p = mine(ctx, u, d.planet);
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
  scheduleShipyard(ctx, p);
  return `${fmt(n)}× ${def.n} in Auftrag gegeben.`;
};

export const pct: Action = (ctx, u, d) => {
  const k = String(d.key);
  if (!(PRODUCERS as readonly string[]).includes(k)) fail('Ungültig.');
  const p = mine(ctx, u, d.planet);
  p.pct[k] = Math.round(int(d.v, 0, 100) / 10) * 10;
  ctx.store.savePlanet(p);
  return null;
};

export const rename: Action = (ctx, u, d) => {
  const n = str(d.name, 20);
  if (!n) fail('Bitte einen Namen eingeben.');
  const p = mine(ctx, u, d.planet);
  p.name = n;
  ctx.store.savePlanet(p);
  return null;
};

/** A display option of the explanation texts (issue #63), or a refusal. */
const explainMode = (x: unknown): ExplainMode =>
  isExplainMode(x) ? x : fail('Ungültig.');

export const options: Action = (ctx, u, d) => {
  // An older client sends no display option; the stored one stays.
  const explain = d.explain === undefined ? u.explain : explainMode(d.explain);
  u.probes = int(d.probes, 1, 1e6);
  u.explain = explain;
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
