// The queues and the clock of the home planet: `clearQueue` (a finished
// build), `finishBuild` (the running order of the build queue, an upgrade or a
// demolition of #202, ends now), `finishUnits` (the shipyard has built the
// first n units of its stored queue now) and `settledAgo` (ms: the planet was
// last brought forward that long ago, so the server adds the production of
// that time).
import type { Planet, SeedPart } from './lib/types.ts';

/** The start of the shipyard that has finished the first `n` units of its queue now. */
function yardStart(p: Planet, n: number): number | null {
  if (p.sqT === null) return null;
  let ms = 0;
  let left = n;
  for (const q of p.sq) {
    const done = Math.min(left, q.n);
    ms += done * q.unit;
    left -= done;
  }
  return Date.now() - ms;
}

export const part: SeedPart = {
  order: 41,
  fields: ['clearQueue', 'finishBuild', 'finishUnits', 'settledAgo'],
  apply({ d, home, planet }) {
    const bq = planet.bq;
    home.bq = d.clearQueue
      ? null
      : bq && d.finishBuild
        ? { ...bq, end: Math.min(bq.end, Date.now()) }
        : bq;
    home.sqT = d.finishUnits ? yardStart(planet, d.finishUnits) : planet.sqT;
    home.t = d.settledAgo ? Date.now() - d.settledAgo : planet.t;
  },
};
