// The list of requirements (#64) answers exactly as before when `needState`
// asks the checks of the economy (#214, F18, owner 2026-11-16): a property
// test on generated places compares today's `needState` with the reference
// below, `needState` of src/core/requirements.ts as it was before, copied
// unchanged but for the names and the `export` keywords.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD, buildable, RES } from '../core/catalog.ts';
import {
  energyNeed,
  energyShort,
} from '../core/components/energy-threshold.ts';
import { afford, lvlCost, reqMissing } from '../core/economy.ts';
import { fieldsFull } from '../core/fields.ts';
import { labUpgrading, waitsForLab } from '../core/lab.ts';
import {
  type Need,
  type NeedState,
  needState,
  type Places,
} from '../core/requirements.ts';
import { text } from '../core/text.ts';
import type { Cost, Planet, ResearchState } from '../core/types.ts';
import { waitsForYard } from '../core/yard.ts';
import { planet, U } from './fixtures.ts';

const defOf = (kind: 'b' | 'r', key: string) =>
  (kind === 'b' ? BUILD : RES)[key];

const PLACE_REASON = {
  planet: 'nur auf einem Mond baubar',
  moon: 'auf einem Mond nicht baubar',
} as const;

const RES_NAMES = ['Adamant', 'Psikristall', 'Promethium'] as const;
const HAVE = ['m', 'c', 'd'] as const;

const lacking = (p: Planet, c: Cost, energy: boolean): string[] => [
  ...RES_NAMES.filter((_, i) => p.res[HAVE[i]!] < c[i]!),
  ...(energy ? ['Energie'] : []),
];

function busyReason(n: Need, p: Planet, r: ResearchState): string | undefined {
  if (n.kind === 'r') {
    if (r.rq) return 'Es wird bereits geforscht';
    return labUpgrading(p) ? 'Scholarium wird ausgebaut' : undefined;
  }
  if (p.bq) return 'Bauschleife belegt';
  if (waitsForYard(p, n.key)) return 'Schiffsschmiede arbeitet gerade';
  if (waitsForLab(r, n.key)) return 'Das Scholarium forscht gerade';
  return undefined;
}

function refNeedState(n: Need, pl: Places): NeedState {
  const p = pl.here;
  const def = defOf(n.kind, n.key)!;
  const level = n.have + 1;
  const cost = lvlCost(def, level);
  const energy = energyNeed(def, level);
  const base: NeedState = energy
    ? { ready: false, cost, energy }
    : { ready: false, cost };
  if (n.kind === 'b' && !buildable(n.key, p.kind))
    return { ...base, reason: PLACE_REASON[p.kind] };
  const missing = reqMissing(def, p, pl.research);
  if (missing.length)
    return { ...base, reason: `braucht ${missing.join(', ')}` };
  if (n.kind === 'b' && fieldsFull(p, pl.cfg))
    return { ...base, reason: 'Keine freien Felder' };
  const short = energyShort(def, level, p, pl.cfg, pl.research.research) > 0;
  if (!afford(p, cost) || short)
    return {
      ...base,
      reason: `zu wenig ${lacking(p, cost, short).join(', ')}`,
    };
  const busy = busyReason(n, p, pl.research);
  return busy ? { ...base, ready: true, busy } : { ...base, ready: true };
}

const BUILDINGS = Object.keys(BUILD);
const RESEARCH = Object.keys(RES);
const level = fc.integer({ min: 0, max: 14 });
const levels = (keys: string[]) =>
  fc.dictionary(fc.constantFrom(...keys), level, { maxKeys: 8 });
const amount = fc.oneof(
  { arbitrary: fc.constant(1e9), weight: 3 },
  { arbitrary: fc.constant(0), weight: 1 },
  { arbitrary: fc.integer({ min: 0, max: 5000 }), weight: 1 },
);

const places = fc.record({
  kind: fc.constantFrom('planet' as const, 'moon' as const),
  diameter: fc.constantFrom(3000, 12800),
  b: levels(BUILDINGS),
  res: fc.record({ m: amount, c: amount, d: amount }),
  // The upgrade of the lab stops research (#49), so it comes often.
  bq: fc.option(fc.oneof(fc.constant('lab'), fc.constantFrom(...BUILDINGS)), {
    nil: null,
  }),
  sq: fc.boolean(),
  research: levels(RESEARCH),
  rq: fc.boolean(),
});

const need = fc.oneof(
  fc.record({
    kind: fc.constant('b' as const),
    // The shipyard and the lab wait for their queues (#48, #49).
    key: fc.oneof(
      fc.constantFrom('yard', 'lab'),
      fc.constantFrom(...BUILDINGS),
    ),
  }),
  fc.record({
    kind: fc.constant('r' as const),
    key: fc.constantFrom(...RESEARCH),
  }),
);

const QUEUE = { lvl: 1, start: 0, end: 9, cost: [0, 0, 0] as Cost };

/** The shown planet and the research of a generated place. */
function placesOf(w: typeof places extends fc.Arbitrary<infer T> ? T : never): {
  here: Planet;
  research: ResearchState;
} {
  const here = planet({
    kind: w.kind,
    diameter: w.diameter,
    b: w.b,
    res: w.res,
    bq: w.bq ? { key: w.bq, ...QUEUE } : null,
    sq: w.sq ? [{ key: 'lf', n: 1 } as never] : [],
  });
  const rq = w.rq ? ({ key: 'spy', ...QUEUE } as never) : null;
  return { here, research: { research: w.research, rq } };
}

describe('the list of requirements against the code before (F18)', () => {
  it('names the same reason, the same wait and the same cost', () => {
    const reasons = new Set<string>();
    fc.assert(
      fc.property(
        places,
        need,
        fc.option(level, { nil: undefined }),
        (w, n, other) => {
          const { here, research } = placesOf(w);
          const levels = n.kind === 'b' ? here.b : research.research;
          // The level of the list, or another one as the unit tests give.
          const have = other ?? levels[n.key] ?? 0;
          const item: Need = {
            ...n,
            name: text(n.key)?.n ?? n.key,
            level: have + 1,
            have,
          };
          const pl: Places = { here, research, cfg: U };
          const before = refNeedState(item, pl);
          expect(needState(item, pl)).toEqual(before);
          reasons.add(before.reason ?? before.busy ?? 'ready');
        },
      ),
      { seed: 214, numRuns: 3000 },
    );
    // The generated places reach every reason and every wait.
    const found = [...reasons].map((r) =>
      r.replace(/^(braucht|zu wenig) .*/, '$1'),
    );
    for (const r of [
      'nur auf einem Mond baubar',
      'auf einem Mond nicht baubar',
      'braucht',
      'Keine freien Felder',
      'zu wenig',
      'Es wird bereits geforscht',
      'Scholarium wird ausgebaut',
      'Bauschleife belegt',
      'Schiffsschmiede arbeitet gerade',
      'Das Scholarium forscht gerade',
      'ready',
    ])
      expect(found).toContain(r);
  });
});
