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

function produce(p: Planet, from: number, until: number, u: Universe): void {
  let t = from;
  while (t < until) {
    let e = until;
    if (p.bq && p.bq.end > t && p.bq.end < e) e = p.bq.end;
    accrue(p, e - t, u);
    t = e;
    completeBuilding(p, t);
  }
  completeBuilding(p, until);
}

function runShipyard(p: Planet, until: number): void {
  let st = p.sqT ?? until;
  while (p.sq.length > 0 && st < until) {
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

/** A copy of the planet as it is at `until` (never earlier than its last state). */
export function settle(src: Planet, until: number, u: Universe): Planet {
  const p = clone(src);
  const from = p.t;
  const end = Math.max(until, from);
  produce(p, from, end, u);
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
