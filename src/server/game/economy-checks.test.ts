// The economy actions refuse exactly when a check of
// src/core/economy-checks.ts holds, with the message of its first code
// (#214, okf/architecture/action-checks.md): a property test on generated
// planets, research and queues. The messages are those of before #214,
// written out here; F10 is the browser's (owner, 2026-11-15, O18 (c)).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD, RES, UNIT } from '../../core/catalog.ts';
import {
  type BuildError,
  buildErrors,
  type OrderError,
  orderErrors,
  type ResearchError,
  researchErrors,
} from '../../core/economy-checks.ts';
import { energyNeed, energyShort } from '../../core/research.ts';
import { text } from '../../core/text.ts';
import type { Levels, Planet, Queue } from '../../core/types.ts';
import { YARD_LOCK } from '../../core/yard.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import * as A from './actions.ts';
import { fmt } from './context.ts';
import type { Ctx } from './context.ts';
import type { User } from '../db/repos/players.ts';

const LOCKED = 'Das Wissen ist noch verschlossen.';
const POOR = 'Der Zehnte reicht nicht aus.';

/** The energy message of the next level of `key` on `p` (#49, #51). */
function energy(ctx: Ctx, p: Planet, research: Levels, key: string): string {
  const def = BUILD[key] ?? RES[key]!;
  const level = ((BUILD[key] ? p.b : research)[key] ?? 0) + 1;
  const short = energyShort(def, level, p, ctx.admin.universe(), research);
  return `Zu wenig Energie: ${text(key)!.n} braucht eine Energieproduktion von ${fmt(energyNeed(def, level))}, es fehlen ${fmt(short)}.`;
}

const PLACE_MESSAGES: Record<Planet['kind'], string> = {
  planet: 'Nur auf einem Mond baubar.',
  moon: 'Auf einem Mond nicht baubar.',
};

const BUILD_MESSAGES: Record<
  Exclude<BuildError, 'place' | 'noEnergy'>,
  string
> = {
  locked: LOCKED,
  full: 'Keine freien Felder.',
  busy: 'Es wird bereits gebaut.',
  yardBusy: 'Die Schiffsschmiede arbeitet gerade.',
  labBusy: 'Das Scholarium forscht gerade.',
  cost: POOR,
};

const RESEARCH_MESSAGES: Record<Exclude<ResearchError, 'noEnergy'>, string> = {
  off: 'Diese Forschung gibt es in dieser Runde nicht.',
  maxLevel: 'Die höchste Stufe dieser Forschung ist erreicht.',
  noLab: 'Du brauchst ein Scholarium.',
  locked: LOCKED,
  busy: 'Es wird bereits geforscht.',
  labUpgrading: 'Das Scholarium wird ausgebaut.',
  cost: POOR,
};

const ORDER_MESSAGES: Record<Exclude<OrderError, 'yardLocked'>, string> = {
  noYard: 'Du brauchst eine Orbitale Schiffsschmiede.',
  locked: LOCKED,
  count: 'Bitte eine Anzahl eingeben.',
  limit: 'Diesen Schutzdom gibt es nur einmal pro Planet.',
  siloFull: 'Nicht genug Platz in der Raketenkrypta.',
  cost: POOR,
  queueFull: 'Die Bauliste der Schiffsschmiede ist voll.',
};

const H = 3_600_000;
/** The only place of Anna, a planet or a moon. */
const HERE = 'p1_1_5';
const queue = (key: string): Queue => ({
  key,
  lvl: 1,
  start: 0,
  end: 1000 * H,
  cost: [0, 0, 0],
});
const levels = (keys: readonly string[], max: number) =>
  fc.dictionary(fc.constantFrom(...keys), fc.integer({ min: 0, max }));

const cases = fc.record({
  kind: fc.constantFrom<Planet['kind']>('planet', 'planet', 'moon'),
  b: levels(
    ['lab', 'yard', 'robot', 'metal', 'solar', 'nanite', 'moonbase'],
    12,
  ),
  research: levels(['energy', 'computer', 'shield', 'comb', 'weapons'], 12),
  bq: fc.option(fc.constantFrom('metal', 'lab', 'yard', 'nanite')),
  rq: fc.boolean(),
  orders: fc.constantFrom(0, 1, 20),
  def: levels(['ssd', 'lsd'], 1),
  res: fc.constantFrom(
    { m: 0, c: 0, d: 0 },
    { m: 3000, c: 3000, d: 3000 },
    { m: 1e7, c: 1e7, d: 1e7 },
  ),
  diameter: fc.constantFrom(1000, 5000, 12800),
  building: fc.constantFrom(...Object.keys(BUILD)),
  study: fc.constantFrom(...Object.keys(RES)),
  unit: fc.constantFrom(...Object.keys(UNIT)),
  n: fc.constantFrom(0, 1, 2, 50),
});

type Case = typeof cases extends fc.Arbitrary<infer T> ? T : never;

/** Anna with one planet of the case, settled as the actions see it. */
function world(c: Case): { ctx: Ctx; u: User; p: () => Planet } {
  const ctx = testCtx(H);
  const u = addUser(ctx, 'Anna', {
    research: c.research,
    rq: c.rq ? { ...queue('spy'), planet: HERE } : null,
  });
  addPlanet(ctx, u.id, {
    kind: c.kind,
    b: c.b,
    bq: c.bq === null ? null : queue(c.bq),
    sq: Array.from({ length: c.orders }, () => ({ key: 'rl', n: 1, unit: H })),
    sqT: c.orders ? H : null,
    def: c.def,
    res: c.res,
    diameter: c.diameter,
    created: 0,
    t: H,
  });
  return { ctx, u, p: () => A.mine(ctx, u, HERE) };
}

/** The answer of an action: its result, or the message it refused with. */
function answer(run: () => unknown): unknown {
  try {
    return run();
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

// Every case closes its database, as in missions-reference.test.ts.
describe(
  'the economy actions answer as their checks (#214)',
  { timeout: 60_000 },
  () => {
    it('build', () => {
      fc.assert(
        fc.property(cases, (c) => {
          const { ctx, u, p } = world(c);
          const r = A.researchOf(ctx, u);
          const at = p();
          const error = buildErrors(at, r, c.building, ctx.admin.universe())[0];
          expect(
            answer(() => A.build(ctx, u, { key: c.building, planet: HERE })),
          ).toBe(error === undefined ? null : `error: ${buildMessage(error)}`);
          ctx.db.close();
          function buildMessage(e: BuildError): string {
            if (e === 'place') return PLACE_MESSAGES[at.kind];
            if (e === 'noEnergy')
              return energy(ctx, at, r.research, c.building);
            return BUILD_MESSAGES[e];
          }
        }),
        { seed: 214, numRuns: 150 },
      );
    });

    it('research', () => {
      fc.assert(
        fc.property(cases, (c) => {
          const { ctx, u, p } = world(c);
          const r = A.researchOf(ctx, u);
          const at = p();
          const error = researchErrors(at, r, c.study, ctx.admin.universe())[0];
          const message = (e: ResearchError): string =>
            e === 'noEnergy'
              ? energy(ctx, at, r.research, c.study)
              : RESEARCH_MESSAGES[e];
          expect(
            answer(() => A.research(ctx, u, { key: c.study, planet: HERE })),
          ).toBe(error === undefined ? null : `error: ${message(error)}`);
          ctx.db.close();
        }),
        { seed: 214, numRuns: 150 },
      );
    });

    it('order', () => {
      fc.assert(
        fc.property(cases, (c) => {
          const { ctx, u, p } = world(c);
          const at = p();
          const error = orderErrors(at, A.researchOf(ctx, u), c.unit, c.n)[0];
          const result = answer(() =>
            A.order(ctx, u, { key: c.unit, n: c.n, planet: HERE }),
          );
          if (error === undefined)
            expect(result).toMatch(/× .* in Auftrag gegeben\.$/);
          else
            expect(result).toBe(
              `error: ${
                error === 'yardLocked'
                  ? `Die ${YARD_LOCK[at.bq!.key]} wird ausgebaut.`
                  : ORDER_MESSAGES[error]
              }`,
            );
          ctx.db.close();
        }),
        { seed: 214, numRuns: 150 },
      );
    });
  },
);
