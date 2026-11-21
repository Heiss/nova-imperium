// The checks of the economy actions, used by the server and the browser
// (okf/architecture/patterns.md, section 7; #214,
// okf/architecture/action-checks.md): `build`, `research`, `order` and
// `pct`. Each check returns every code that applies, in the order of the
// server: the server refuses with the message of the first, the browser
// shows the note of the first in its own order. The predicates stay their
// parts (`waitsForYard`, `labUpgrading`, `fieldsFull`, `energyShort` …).
// Build and research have one order on both sides (owner, 2026-11-15,
// O18 (c): F8, F9): the place, the requirements and the fields first, then
// the waits of the queues, the energy and the cost.
import { BUILD, buildable, PRODUCERS, RES, UNIT } from './catalog.ts';
import { colonyRules, researchRefused } from './colony-limit.ts';
import { afford, lvlCost, maxAfford, reqMissing } from './economy.ts';
import { fieldsFull } from './fields.ts';
import { hasLab, labUpgrading, waitsForLab } from './lab.ts';
import { energyShort } from './research.ts';
import type { Planet, ResearchState, Universe } from './types.ts';
import {
  hasYard,
  limitRoom,
  siloRoom,
  waitsForYard,
  yardLockedBy,
} from './yard.ts';

/** The codes whose check holds, in the order of the record (also of `demolitionErrors`, #202). */
export const holding = <T extends string>(
  checks: Readonly<Record<T, boolean>>,
): T[] => (Object.keys(checks) as T[]).filter((code) => checks[code]);

/**
 * Why the next level of a building cannot start on a place: it cannot stand
 * there (#53), its requirements are missing, no field is free (#51), the
 * build queue runs, it waits for the orders of the shipyard (#48) or for
 * the running research, the energy production is short (#51), or the
 * place cannot pay it.
 */
export type BuildError =
  | 'place'
  | 'locked'
  | 'full'
  | 'busy'
  | 'yardBusy'
  | 'labBusy'
  | 'noEnergy'
  | 'cost';

/**
 * Every reason why the next level of building `key` cannot start on `p`;
 * `have` is the level it starts from (the list of requirements names its
 * own, F18), else the level on `p`.
 */
export function buildErrors(
  p: Planet,
  r: ResearchState,
  key: string,
  u: Universe,
  have = p.b[key] ?? 0,
): BuildError[] {
  const def = BUILD[key]!;
  const level = have + 1;
  return holding<BuildError>({
    place: !buildable(key, p.kind),
    locked: reqMissing(def, p, r).length > 0,
    full: fieldsFull(p, u),
    busy: !!p.bq,
    yardBusy: waitsForYard(p, key),
    labBusy: waitsForLab(r, key),
    noEnergy: energyShort(def, level, p, u, r.research) > 0,
    cost: !afford(p, lvlCost(def, level)),
  });
}

/**
 * Why the next level of a research cannot start on a place (#49): the round
 * does not have it or its highest level is reached (the Kolonialverwaltung,
 * #237), the place has no lab, its requirements are missing, a research
 * runs, the lab is upgraded, the energy production is short, or the place
 * cannot pay it.
 */
export type ResearchError =
  | 'off'
  | 'maxLevel'
  | 'noLab'
  | 'locked'
  | 'busy'
  | 'labUpgrading'
  | 'noEnergy'
  | 'cost';

/**
 * Every reason why the next level of research `key` cannot start on `p`;
 * `have` as for `buildErrors`, else the level researched.
 */
export function researchErrors(
  p: Planet,
  r: ResearchState,
  key: string,
  u: Universe,
  have = r.research[key] ?? 0,
): ResearchError[] {
  const def = RES[key]!;
  const level = have + 1;
  const refused = researchRefused(key, colonyRules(u), have);
  return holding<ResearchError>({
    off: refused === 'off',
    maxLevel: refused === 'maxLevel',
    noLab: !hasLab(p),
    locked: reqMissing(def, p, r).length > 0,
    busy: !!r.rq,
    labUpgrading: labUpgrading(p),
    noEnergy: energyShort(def, level, p, u, r.research) > 0,
    cost: !afford(p, lvlCost(def, level)),
  });
}

/** The orders the list of the shipyard holds at most. */
export const MAX_SHIPYARD_ORDERS = 20;

/**
 * Why an order of `n` units cannot start: the place has no shipyard, an
 * upgrade locks it (#48), the requirements are missing, no count is given
 * (F10), more than the limit of the unit (#50), more missiles than the
 * silos hold (#54), not even one unit can be paid, or the list of the
 * shipyard is full.
 */
export type OrderError =
  | 'noYard'
  | 'yardLocked'
  | 'locked'
  | 'count'
  | 'limit'
  | 'siloFull'
  | 'cost'
  | 'queueFull';

/** Every reason why an order of `n` units of `key` cannot start on `p`. */
export function orderErrors(
  p: Planet,
  r: ResearchState,
  key: string,
  n: number,
): OrderError[] {
  const def = UNIT[key]!;
  return holding<OrderError>({
    noYard: !hasYard(p),
    yardLocked: yardLockedBy(p) !== null,
    locked: reqMissing(def, p, r).length > 0,
    count: n < 1,
    limit: n > limitRoom(p, key),
    siloFull: n > siloRoom(p, key),
    cost: maxAfford(p, def.cost) < 1,
    queueFull: p.sq.length >= MAX_SHIPYARD_ORDERS,
  });
}

/** Whether the production share of `key` can be set: a producer only. */
export const isProducer = (key: string): boolean => PRODUCERS.includes(key);
