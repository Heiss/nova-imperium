// Moves a planet or the research of a player forward to a point in time:
// production, the finished building, the finished units of the shipyard.
import { isShip } from './catalog.ts';
import { accrue } from './economy.ts';
import type { Planet, ResearchState, Universe } from './types.ts';

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

/**
 * Production and shipyard up to `until`. Production is split where it
 * changes: at the end of the building and when a Solarsatellit is finished
 * (its energy counts from then on). Building and running shipyard first
 * catch up to `from`, so every split point is later than `t`. Without satellites in the
 * queue the split is the one of version 1.
 */
function produce(p: Planet, from: number, until: number, u: Universe): void {
  completeBuilding(p, from);
  catchUp(p, from);
  let t = from;
  while (t < until) {
    // Both are later than t: what ends at t is completed at the loop's end.
    const e = Math.min(until, p.bq?.end ?? until, nextSatellite(p));
    accrue(p, e - t, u);
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

/** A copy of the planet as it is at `until` (never earlier than its last state). */
export function settle(src: Planet, until: number, u: Universe): Planet {
  const p = clone(src);
  const from = p.t;
  const end = Math.max(until, from);
  produce(p, from, end, u);
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
