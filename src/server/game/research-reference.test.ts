// Starting a research settles the same planets as before #115: a property
// test on generated players, planets and queues with a fixed clock. Each
// case builds two equal databases, starts the research with today's code on
// one and with the reference on the other, and compares the answer and
// every table. The reference below is the research action of
// src/server/game/actions.ts as it was on main before #115, with
// settleReactors() and the private helpers it calls, copied unchanged but
// for the names of the copies.
import Database from 'better-sqlite3';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD, RES } from '../../core/catalog.ts';
import {
  afford,
  lvlCost,
  pay,
  reqMissing,
  researchTime,
} from '../../core/economy.ts';
import { labUpgrading } from '../../core/lab.ts';
import {
  energyNeed,
  energyShort,
  labSite,
  networkLab,
} from '../../core/research.ts';
import { settle } from '../../core/settle.ts';
import { text } from '../../core/text.ts';
import type {
  Cost,
  Levels,
  Planet,
  Queue,
  ResearchState,
} from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import { openDatabase } from '../db/database.ts';
import type { User } from '../db/repos/players.ts';
import { queuePush } from '../push-store.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import * as A from './actions.ts';
import { type Action, mine, ownLabs, researchOf } from './actions.ts';
import { type Ctx, fail, fmt, universe } from './context.ts';

// ---- reference: the research action of actions.ts before #115 ----

function settleReactors(ctx: Ctx, u: User): void {
  if (u.rq?.key !== 'energy' || u.rq.end > ctx.now()) return;
  for (const x of ctx.planets.ofOwner(u.id))
    if ((x.b.fusion ?? 0) > 0 || x.bq?.key === 'fusion')
      ctx.planets.save(settle(x, ctx.now(), universe(ctx), u));
}

function setResearch(ctx: Ctx, u: User, r: ResearchState): void {
  settleReactors(ctx, u);
  u.research = r.research;
  u.rq = r.rq;
  ctx.players.save(u);
}

function checkEnergy(
  ctx: Ctx,
  p: Planet,
  r: ResearchState,
  k: string,
  def: { energy?: { base: number; f: number } },
  level: number,
): void {
  const short = energyShort(def, level, p, universe(ctx), r.research);
  if (short > 0)
    fail(
      `Zu wenig Energie: ${text(k)!.n} braucht eine Energieproduktion von ${fmt(energyNeed(def, level))}, es fehlen ${fmt(short)}.`,
    );
}

function payNextLevel(
  ctx: Ctx,
  p: Planet,
  next: { def: { cost: Cost; f?: number }; key: string; have: number },
  time: (c: Cost) => number,
  event: AuditEntry | undefined,
): Queue {
  const lvl = next.have + 1;
  const cost = lvlCost(next.def, lvl);
  if (!afford(p, cost)) fail('Der Zehnte reicht nicht aus.');
  pay(p, cost);
  const start = ctx.now();
  const q = { key: next.key, lvl, start, end: start + time(cost), cost };
  if (event)
    event.detail = { planet: p.id, key: q.key, level: lvl, due: q.end };
  return q;
}

const checkResearch = (p: Planet, r: ResearchState, k: string): void => {
  if (!((p.b.lab ?? 0) > 0)) fail('Du brauchst ein Scholarium.');
  if (r.rq) fail('Es wird bereits geforscht.');
  if (labUpgrading(p)) fail('Das Scholarium wird ausgebaut.');
  if (reqMissing(RES[k]!, p, r).length)
    fail('Das Wissen ist noch verschlossen.');
};

const research: Action = (ctx, u, d, event) => {
  const k = String(d.key);
  const def = RES[k] ?? fail('Unbekannte Forschung.');
  const p = mine(ctx, u, d.planet);
  const r = researchOf(ctx, u);
  const have = r.research[k] ?? 0;
  checkResearch(p, r, k);
  checkEnergy(ctx, p, r, k, def, have + 1);
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
  queuePush(ctx, u.id, 'research', String(q.start), q.end);
  return null;
};

// ---- the property test ----

const TEMPLATE = openDatabase(':memory:').serialize();
const H = 3600000;
const NOW = 100 * H;
const RESEARCH = Object.keys(RES);
const BUILDINGS = Object.keys(BUILD);

const oneOf = <T>(often: readonly T[], all: readonly T[]): fc.Arbitrary<T> =>
  fc.oneof(fc.constantFrom(...often), fc.constantFrom(...all));

const levels = (keys: readonly string[], max: number): fc.Arbitrary<Levels> =>
  fc
    .array(fc.tuple(fc.constantFrom(...keys), fc.integer({ min: 0, max })), {
      maxLength: keys.length,
    })
    .map((pairs) => Object.fromEntries(pairs));

const planets = fc.array(
  fc.record({
    b: fc.tuple(
      levels(['lab', 'deut', 'fusion', 'metal', 'solar'], 12),
      levels(BUILDINGS, 4),
    ),
    bq: fc.option(
      fc.record({
        key: oneOf(['fusion', 'lab'], BUILDINGS),
        end: fc.integer({ min: 0, max: 2 * NOW }),
      }),
    ),
    // Sometimes empty, for a throttled reactor; mostly enough to pay.
    d: fc.oneof(
      fc.constant(0),
      fc.double({ min: 0, max: 1e6, noNaN: true }),
      fc.constant(1e6),
    ),
    t: fc.integer({ min: 0, max: NOW }),
  }),
  { minLength: 1, maxLength: 4 },
);

interface Case {
  research: Levels;
  rq: { key: string; end: number } | null;
  planets: typeof planets extends fc.Arbitrary<infer T> ? T : never;
  key: string;
  at: number;
}

const cases: fc.Arbitrary<Case> = fc.record({
  research: levels(RESEARCH, 10),
  rq: fc.option(
    fc.record({
      key: oneOf(['energy'], RESEARCH),
      // Mostly finished: then a new research may start.
      end: fc.integer({ min: 0, max: NOW + 10 * H }),
    }),
  ),
  planets,
  // Mostly one whose requirements are often met.
  key: fc.oneof(
    { weight: 3, arbitrary: fc.constant('energy') },
    { weight: 1, arbitrary: fc.constantFrom(...RESEARCH, 'nope') },
  ),
  at: fc.integer({ min: 0, max: 3 }),
});

/** Every table of the database, row by row. */
function dump(ctx: Ctx): Record<string, unknown[]> {
  const tables = ctx.db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      ctx.db.prepare(`SELECT * FROM "${name}"`).all(),
    ]),
  );
}

/** Anna starts the research `c.key` on one of her planets: the answer and every table. */
function start(c: Case, act: Action) {
  const db = new Database(TEMPLATE);
  db.pragma('foreign_keys = ON');
  const ctx = testCtx(NOW, 115, db);
  const anna = addUser(ctx, 'Anna', {
    research: c.research,
    rq: c.rq && {
      key: c.rq.key,
      lvl: (c.research[c.rq.key] ?? 0) + 1,
      start: 0,
      end: c.rq.end,
      cost: [0, 0, 0],
      planet: 'p1_1_5',
    },
  });
  c.planets.forEach((x, i) => {
    // Mostly with a lab, so research can start.
    const b: Levels = { lab: 1, ...x.b[1], ...x.b[0] };
    addPlanet(ctx, anna.id, {
      s: i + 1,
      b,
      bq: x.bq && {
        key: x.bq.key,
        lvl: (b[x.bq.key] ?? 0) + 1,
        start: 0,
        end: x.bq.end,
        cost: [1, 1, 1],
      },
      res: { m: 1e6, c: 1e6, d: x.d },
      t: x.t,
      created: 0,
    });
  });
  let answer: unknown;
  try {
    const at = (c.at % c.planets.length) + 1;
    answer = act(ctx, anna, { key: c.key, planet: `p1_${at}_5` });
  } catch (e) {
    answer = `error: ${(e as Error).message}`;
  }
  const result = { answer, db: dump(ctx) };
  ctx.db.close();
  return result;
}

// Every case closes its database, as in missions-reference.test.ts.
describe(
  'starting a research settles the planets of before (#115)',
  { timeout: 120_000 },
  () => {
    it('with the same answer and every table bit for bit', () => {
      fc.assert(
        fc.property(cases, (c) => {
          expect(start(c, A.research)).toEqual(start(c, research));
        }),
        { seed: 115, numRuns: 300 },
      );
    });

    it('starts research and settles planets in the generated cases', () => {
      let started = 0;
      let settled = 0;
      fc.assert(
        fc.property(cases, (c) => {
          const { answer, db } = start(c, research);
          if (answer === null) started++;
          const moved = (db.planets as { t: number }[]).filter(
            (p) => p.t === NOW,
          );
          if (answer === null && moved.length > 1) settled++;
        }),
        { seed: 115, numRuns: 300 },
      );
      expect(started).toBeGreaterThan(50);
      expect(settled).toBeGreaterThan(15);
    });
  },
);
