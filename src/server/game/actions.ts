// The actions of a player on their planet. Each one runs inside a transaction
// (see dispatch.ts) and saves what it changes.
import { BUILD, RES, UNIT } from '../../core/catalog.ts';
import {
  buildTime,
  lvlCost,
  maxAfford,
  pay,
  refund,
  researchTime,
  unitTime,
} from '../../core/economy.ts';
import {
  type BuildError,
  buildErrors,
  isProducer,
  type OrderError,
  orderErrors,
  type ResearchError,
  researchErrors,
} from '../../core/economy-checks.ts';
import { type ExplainMode, storedMode } from '../../core/explain.ts';
import { isLevelMode, type LevelMode } from '../../core/level-overview.ts';
import {
  energyNeed,
  energyShort,
  type LabSite,
  labSite,
  networkLab,
} from '../../core/research.ts';
import { feelsResearch, settle, settleR } from '../../core/settle.ts';
import { text } from '../../core/text.ts';
import { YARD_LOCK, yardLockedBy } from '../../core/yard.ts';
import type { Cost, Planet, Queue, ResearchState } from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import {
  cancelScheduledPush,
  orderPush,
  queuePush,
  scheduleShipyard,
} from '../push-store.ts';
import type { User } from '../db/repos/players.ts';
import { type Ctx, fail, fmt, int, str, universe } from './context.ts';
import { mainPlanet } from './main-planet.ts';

export type Data = Record<string, unknown>;

/**
 * What an action answers besides its message: data the view shows, such as
 * the flights of a scan of the Auspex-Phalanx (#53). The reply of the
 * action carries it beside the new state.
 */
export interface Answer {
  msg: string | null;
  data: Data;
}

export type Action = (
  ctx: Ctx,
  u: User,
  d: Data,
  event?: AuditEntry,
) => string | null | Answer;

/** The message and the data of what an action answered. */
export const answerOf = (
  result: string | null | Answer,
): { msg: string | null; data?: Data } =>
  result !== null && typeof result === 'object' ? result : { msg: result };

/** The selected planet, or the main planet (#221) for callers without a selection. */
export function mine(ctx: Ctx, u: User, id?: unknown): Planet {
  const p = id === undefined ? mainPlanet(ctx, u) : ctx.planets.get(String(id));
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
 * The stored research forgets when a research finished once a new one
 * starts. The planets whose production it changes (Energietechnik for a
 * Fusionskraftwerk, #47), now or once their building is finished, take
 * that end into their production first (#115), so it does not matter when
 * they are settled.
 */
function settleResearchEnd(ctx: Ctx, u: User): void {
  const q = u.rq;
  if (!q || q.end > ctx.now()) return;
  for (const x of ctx.planets.ofOwner(u.id))
    if (feelsResearch(x, universe(ctx), u.research, q.key))
      ctx.planets.save(settle(x, ctx.now(), universe(ctx), u));
}

function setResearch(ctx: Ctx, u: User, r: ResearchState): void {
  settleResearchEnd(ctx, u);
  u.research = r.research;
  u.rq = r.rq;
  ctx.players.save(u);
}

const LOCKED = 'Das Wissen ist noch verschlossen.';
const POOR = 'Der Zehnte reicht nicht aus.';

/**
 * The energy production a level needs on the planet where it starts: the
 * Gravitonforschung (#49) and the Weltenschmiede (#51). Checked, not used up.
 */
function failEnergy(
  ctx: Ctx,
  p: Planet,
  r: ResearchState,
  k: string,
  def: { energy?: { base: number; f: number } },
  level: number,
): never {
  const short = energyShort(def, level, p, universe(ctx), r.research);
  return fail(
    `Zu wenig Energie: ${text(k)!.n} braucht eine Energieproduktion von ${fmt(energyNeed(def, level))}, es fehlen ${fmt(short)}.`,
  );
}

/** The Mondzitadelle stands on moons only, the mines and others on planets only (#53). */
const PLACE_ERROR = {
  planet: 'Nur auf einem Mond baubar.',
  moon: 'Auf einem Mond nicht baubar.',
} as const;

/** The messages of the codes of `buildErrors` but the place and the energy. */
const BUILD_ERROR: Readonly<
  Record<Exclude<BuildError, 'place' | 'noEnergy'>, string>
> = {
  locked: LOCKED,
  // Every building level takes a field (#51).
  full: 'Keine freien Felder.',
  busy: 'Es wird bereits gebaut.',
  yardBusy: 'Die Schiffsschmiede arbeitet gerade.',
  labBusy: 'Das Scholarium forscht gerade.',
  cost: POOR,
};

function checkBuild(ctx: Ctx, p: Planet, r: ResearchState, k: string): void {
  const error = buildErrors(p, r, k, universe(ctx))[0];
  if (error === 'place') return fail(PLACE_ERROR[p.kind]);
  if (error === 'noEnergy')
    failEnergy(ctx, p, r, k, BUILD[k]!, (p.b[k] ?? 0) + 1);
  if (error) fail(BUILD_ERROR[error]);
}

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
  checkBuild(ctx, p, researchOf(ctx, u), k);
  const q = payNextLevel(
    ctx,
    p,
    { def, key: k, have: p.b[k] ?? 0 },
    (c) => buildTime(c, p, universe(ctx)),
    event,
  );
  p.bq = q;
  ctx.planets.save(p);
  queuePush(ctx, u.id, orderPush('buildings', `${p.id}:${q.start}`, q.end));
  return null;
};

export const cancelBuild: Action = (ctx, u, d) => {
  const p = mine(ctx, u, d.planet);
  if (!p.bq) return null;
  refund(p, p.bq.cost);
  cancelScheduledPush(ctx, u.id, 'buildings', `${p.id}:${p.bq.start}`);
  p.bq = null;
  ctx.planets.save(p);
  return null;
};

/** The messages of the codes of `researchErrors` but the energy. */
const RESEARCH_ERROR: Readonly<
  Record<Exclude<ResearchError, 'noEnergy'>, string>
> = {
  noLab: 'Du brauchst ein Scholarium.',
  locked: LOCKED,
  busy: 'Es wird bereits geforscht.',
  labUpgrading: 'Das Scholarium wird ausgebaut.',
  cost: POOR,
};

function checkResearch(ctx: Ctx, p: Planet, r: ResearchState, k: string): void {
  const error = researchErrors(p, r, k, universe(ctx))[0];
  if (error === 'noEnergy')
    failEnergy(ctx, p, r, k, RES[k]!, (r.research[k] ?? 0) + 1);
  if (error) fail(RESEARCH_ERROR[error]);
}

/** The labs of all own planets, moved to now, for the research network (#49). */
export const ownLabs = (ctx: Ctx, uid: string): LabSite[] =>
  ctx.planets
    .ofOwner(uid)
    .map((x) => labSite(settle(x, ctx.now(), universe(ctx))));

/** Starts research on the selected own planet, which pays it (#49). */
export const research: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = RES[k] ?? fail('Unbekannte Forschung.');
  const p = mine(ctx, u, d.planet);
  const r = researchOf(ctx, u);
  const have = r.research[k] ?? 0;
  checkResearch(ctx, p, r, k);
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
  ctx.planets.save(p);
  queuePush(ctx, u.id, orderPush('research', String(q.start), q.end));
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
  ctx.planets.save(p);
  return null;
};

/** The messages of the codes of `orderErrors` but the lock of the shipyard. */
const ORDER_ERROR: Readonly<Record<Exclude<OrderError, 'yardLocked'>, string>> =
  {
    noYard: 'Du brauchst eine Orbitale Schiffsschmiede.',
    locked: LOCKED,
    // F10, as the browser says it (owner, 2026-11-15, O18 (c)).
    count: 'Bitte eine Anzahl eingeben.',
    // The component `limit`: only the two shield domes have one (#50).
    limit: 'Diesen Schutzdom gibt es nur einmal pro Planet.',
    // The components `silo` and `missile`: the missiles (#54) [V].
    siloFull: 'Nicht genug Platz in der Raketenkrypta.',
    cost: POOR,
    queueFull: 'Die Bauliste der Schiffsschmiede ist voll.',
  };

function checkOrder(p: Planet, r: ResearchState, k: string, n: number): void {
  const error = orderErrors(p, r, k, n)[0];
  if (error === 'yardLocked')
    return fail(`Die ${YARD_LOCK[yardLockedBy(p)!]} wird ausgebaut.`);
  if (error) fail(ORDER_ERROR[error]);
}

export const order: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = UNIT[k] ?? fail('Unbekannte Einheit.');
  const p = mine(ctx, u, d.planet);
  const want = int(d.n, 0, 1e9);
  checkOrder(p, researchOf(ctx, u), k, want);
  const n = Math.min(want, maxAfford(p, def.cost));
  pay(p, def.cost, n);
  if (!p.sq.length) p.sqT = ctx.now();
  p.sq.push({ key: k, n, unit: unitTime(def, p, universe(ctx)) });
  ctx.planets.save(p);
  if (event) event.detail = { planet: p.id, key: k, units: n };
  scheduleShipyard(ctx, p);
  return `${fmt(n)}× ${text(k)!.n} in Auftrag gegeben.`;
};

export const pct: Action = (ctx, u, d) => {
  const k = String(d.key);
  if (!isProducer(k)) fail('Ungültig.');
  const p = mine(ctx, u, d.planet);
  p.pct[k] = Math.round(int(d.v, 0, 100) / 10) * 10;
  ctx.planets.save(p);
  return null;
};

export const rename: Action = (ctx, u, d) => {
  const n = str(d.name, 20);
  if (!n) fail('Bitte einen Namen eingeben.');
  const p = mine(ctx, u, d.planet);
  p.name = n;
  ctx.planets.save(p);
  return null;
};

/**
 * A display option of the „?“ (issue #63, #285 B2), or a refusal; „Immer
 * anzeigen“ of an older client becomes the „?“.
 */
const explainMode = (x: unknown): ExplainMode =>
  storedMode(x) ?? fail('Ungültig.');

/** The display option of the level overview (#187), or a refusal. */
const levelTableMode = (x: unknown): LevelMode =>
  isLevelMode(x) ? x : fail('Ungültig.');

export const options: Action = (ctx, u, d) => {
  // An older client sends no display option; the stored one stays.
  const explain = d.explain === undefined ? u.explain : explainMode(d.explain);
  const levelTable =
    d.levelTable === undefined ? u.levelTable : levelTableMode(d.levelTable);
  u.probes = int(d.probes, 1, 1e6);
  u.explain = explain;
  u.levelTable = levelTable;
  ctx.players.save(u);
  return 'Gespeichert.';
};

export const read: Action = (ctx, u) => {
  u.readAt = Math.max(0, ...ctx.reports.ofPlayer(u.id).map((r) => r.time));
  ctx.players.save(u);
  return null;
};

export const delrep: Action = (ctx, u, d) => {
  ctx.reports.delete(u.id, String(d.id));
  return null;
};

export const delall: Action = (ctx, u) => {
  ctx.reports.deleteAll(u.id);
  return null;
};
