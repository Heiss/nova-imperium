// Moves a planet or the research of a player forward to a point in time:
// production, the finished building, the finished units of the shipyard.
// Production runs in segments with constant rates; a segment ends at the
// next generic event (okf/architecture/patterns.md, section 3; #115): the
// building finishes, the shipyard finishes a unit with production
// components, a research finishes that a rate reads, or a use empties a
// stock (in accrue). No rule here names a key.
import { isShip, PRODUCERS } from './catalog.ts';
import { accrue, readsResearch } from './economy.ts';
import type { Levels, Planet, ResearchState, Universe } from './types.ts';

const clone = <T>(o: T): T => structuredClone(o);

function completeBuilding(p: Planet, t: number): void {
  if (p.bq && p.bq.end <= t) {
    p.b[p.bq.key] = p.bq.lvl;
    p.bq = null;
  }
}

/** The units with production components: when one is finished, production changes. */
const PRODUCING: ReadonlySet<string> = new Set(PRODUCERS);

/** When the shipyard finishes its next unit with production components (the Solarsatellit, #46), or Infinity. */
function nextProducer(p: Planet): number {
  if (p.sqT === null) return Infinity;
  let st = p.sqT;
  for (const q of p.sq) {
    if (PRODUCING.has(q.key)) return st + q.unit;
    st += q.n * q.unit;
  }
  return Infinity;
}

/** The research levels of the owner at `t`, the running research once it is done. */
const levelsAt = (r: ResearchState | null | undefined, t: number): Levels =>
  r ? settleR(r, t).research : {};

/**
 * When the running research finishes after `t`, if a rate of an entry on
 * `p` reads it (Energietechnik for a Fusionskraftwerk, #47); otherwise
 * Infinity.
 */
function researchEnd(
  p: Planet,
  u: Universe,
  r: ResearchState | null | undefined,
  t: number,
): number {
  if (!r?.rq || !(r.rq.end > t)) return Infinity;
  return readsResearch(p, u, r.research, r.rq.key) ? r.rq.end : Infinity;
}

/**
 * Whether the end of the research `key` changes the production of `p`, now
 * or once its building is finished: a rate of an entry on it reads the
 * research (#115). The server settles these planets before the stored
 * research forgets when it finished.
 */
export function feelsResearch(
  p: Planet,
  u: Universe,
  research: Levels,
  key: string,
): boolean {
  if (readsResearch(p, u, research, key)) return true;
  const q = p.bq;
  if (!q) return false;
  const built = { ...p, b: { ...p.b, [q.key]: q.lvl } };
  return readsResearch(built, u, research, key);
}

/**
 * Production and shipyard up to `until`. Production is split at the
 * generic events: at the end of the building, when the shipyard finishes a
 * unit with production components (a Solarsatellit: its energy counts from
 * then on) and when a research finishes that a rate on the planet reads
 * (Energietechnik for a Fusionskraftwerk); `accrue` splits where a use
 * empties a stock. Building and running shipyard first catch up to `from`,
 * so every split point is later than `t`. Without a unit with production
 * components in the queue, a stock that a use empties and a research that
 * a rate reads, the split is the one of version 1.
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
      nextProducer(p),
      researchEnd(p, u, r, t),
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
