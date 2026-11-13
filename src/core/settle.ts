// Moves a planet or the research of a player forward to a point in time:
// production, the finished building, the finished units of the shipyard.
import { isShip } from './catalog.ts';
import { accrue } from './economy.ts';
import type { Levels, Planet, ResearchState, Universe } from './types.ts';

const clone = <T>(o: T): T => structuredClone(o);

function completeBuilding(p: Planet, t: number): void {
  if (p.bq && p.bq.end <= t) {
    p.b[p.bq.key] = p.bq.lvl;
    p.bq = null;
  }
}

/** When the shipyard finishes its next Solarsatellit, or Infinity. */
function nextSatellite(p: Planet): number {
  if (p.sqT === null) return Infinity;
  let st = p.sqT;
  for (const q of p.sq) {
    if (q.key === 'sat') return st + q.unit;
    st += q.n * q.unit;
  }
  return Infinity;
}

/** The research levels of the owner at `t`, the running research once it is done. */
const levelsAt = (r: ResearchState | null | undefined, t: number): Levels =>
  r ? settleR(r, t).research : {};

/**
 * When Energietechnik finishes after `t`, if `p` has a Fusionskraftwerk
 * whose energy it changes (#47); otherwise Infinity.
 */
function techChange(
  p: Planet,
  r: ResearchState | null | undefined,
  t: number,
): number {
  const q = r?.rq;
  const feels = q?.key === 'energy' && (p.b.fusion ?? 0) > 0;
  return feels && q.end > t ? q.end : Infinity;
}

/**
 * Production and shipyard up to `until`. Production is split where it
 * changes: at the end of the building, when a Solarsatellit is finished
 * (its energy counts from then on) and when Energietechnik finishes for a
 * Fusionskraftwerk; `accrue` splits where the deuterium stock runs empty.
 * Building and running shipyard first catch up to `from`, so every split
 * point is later than `t`. Without satellites in the queue and without a
 * Fusionskraftwerk the split is the one of version 1.
 */
function produce(
  p: Planet,
  from: number,
  until: number,
  u: Universe,
  r: ResearchState | null | undefined,
): void {
  completeBuilding(p, from);
  catchUp(p, from);
  let t = from;
  while (t < until) {
    // All are later than t: what ends at t is completed at the loop's end.
    const e = Math.min(
      until,
      p.bq?.end ?? until,
      nextSatellite(p),
      techChange(p, r, t),
    );
    accrue(p, e - t, u, levelsAt(r, t));
    t = e;
    completeBuilding(p, t);
    catchUp(p, t);
  }
  completeBuilding(p, until);
}

function runShipyard(p: Planet, until: number): void {
  let st = p.sqT ?? until;
  // Stops at the first order that is not done by `until` (n ≤ 0 there).
  while (p.sq.length > 0) {
    const q = p.sq[0]!;
    const n = Math.min(q.n, Math.floor((until - st) / q.unit));
    if (n > 0) {
      const target = isShip(q.key) ? p.ships : p.def;
      target[q.key] = (target[q.key] ?? 0) + n;
      q.n -= n;
      st += n * q.unit;
    }
    if (q.n > 0) break;
    p.sq.shift();
  }
  p.sqT = p.sq.length ? st : null;
}

/** Runs a shipyard that has started; one without a start time waits. */
function catchUp(p: Planet, t: number): void {
  if (p.sqT !== null) runShipyard(p, t);
}

/**
 * A copy of the planet as it is at `until` (never earlier than its last
 * state). `r` is the research of the owner as stored, its running research
 * included; only a Fusionskraftwerk reads it (#47).
 */
export function settle(
  src: Planet,
  until: number,
  u: Universe,
  r?: ResearchState | null,
): Planet {
  const p = clone(src);
  const from = p.t;
  const end = Math.max(until, from);
  produce(p, from, end, u, r);
  // A shipyard without a start time starts now.
  runShipyard(p, end);
  p.t = end;
  return p;
}

export function settleR(src: ResearchState, until: number): ResearchState {
  const r = clone(src);
  if (r.rq && r.rq.end <= until) {
    r.research[r.rq.key] = r.rq.lvl;
    r.rq = null;
  }
  return r;
}
