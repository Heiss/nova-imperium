// The points and the highscore categories of every player in one pass
// (#405, owner, 2026-11-25): a pass loads every player, planet and fleet and
// settles each planet once, for the total and the categories together. The
// state, the guilds and the finds of an expedition take the stored pass,
// made N times a day by the clock of the server, or at most every 10 s with
// N = 0 (core/highscore-passes.ts); a check of an action computes the exact
// points of its two players (`exactPoints`), the archive of a round a fresh
// pass. [V] The pass is kept in the memory of the server: a restart makes a
// new one at the first reader.
import { BUILD, FIGHTERS, RES, SHIPS, UNIT } from '../../core/catalog.ts';
import { passHolds } from '../../core/highscore-passes.ts';
import { pointsOf } from '../../core/points.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Levels } from '../../core/types.ts';
import { type Ctx, universe } from './context.ts';
import { sumLevels } from '../../core/economy.ts';
import { roundRules } from './round.ts';

/** The categories of the highscore besides the total (#78). */
interface CategoryScores {
  buildings: number;
  research: number;
  fleet: number;
  defense: number;
}

/** The resources in units: what their costs sum to. */
const unitValue = (units: Levels, defs: typeof UNIT): number => {
  let s = 0;
  for (const [k, n] of Object.entries(units)) {
    const d = defs[k];
    if (d) s += (d.cost[0] + d.cost[1] + d.cost[2]) * n;
  }
  return s;
};

/** The resources in the levels of buildings or research. */
const levelValue = (have: Levels, defs: typeof BUILD | typeof RES): number => {
  let s = 0;
  for (const k of Object.keys(defs)) s += sumLevels(defs[k]!, have[k] ?? 0);
  return s;
};

export interface ScorePass {
  /** When the pass was made: „Stand“ of the highscore. */
  at: number;
  /** The points of every player (1 per 1,000 resources). */
  total: Record<string, number>;
  categories: Record<string, CategoryScores>;
}

/**
 * The units that fight: a missile does not, and counts only in the total
 * (#54, okf/features/highscore-categories.md).
 */
const DEFENSE: typeof UNIT = Object.fromEntries(
  Object.keys(FIGHTERS).map((k) => [k, UNIT[k]!]),
);

const count = (have: Levels, defs: Record<string, unknown>): number => {
  let n = 0;
  for (const k of Object.keys(defs)) n += have[k] ?? 0;
  return n;
};

interface Raw {
  value: number;
  scores: CategoryScores;
}

/**
 * One pass now, over every player or only the players of `only`: each
 * planet is settled once for the total and the categories.
 */
export function scorePass(ctx: Ctx, only?: ReadonlySet<string>): ScorePass {
  const t = ctx.now();
  const u = universe(ctx);
  const takes = (id: string): boolean => !only || only.has(id);
  const raw: Record<string, Raw> = {};
  for (const user of ctx.players.all()) {
    if (!takes(user.id)) continue;
    const research = settleR(user, t).research;
    raw[user.id] = {
      value: levelValue(research, RES),
      scores: {
        buildings: 0,
        research: count(research, RES),
        fleet: 0,
        defense: 0,
      },
    };
  }
  // Every planet and fleet has an owner (foreign keys of the database).
  const planets = only
    ? [...only].flatMap((id) => ctx.planets.ofOwner(id))
    : ctx.planets.all();
  for (const p of planets) {
    const s = settle(p, t, u);
    const r = raw[p.owner]!;
    const buildings = levelValue(s.b, BUILD);
    r.value += buildings + unitValue({ ...s.ships, ...s.def }, UNIT);
    r.scores.buildings += buildings;
    r.scores.fleet += count(s.ships, SHIPS);
    r.scores.defense += unitValue(s.def, DEFENSE);
  }
  // Missiles in flight count in the total until their impact (#54, owiki).
  for (const f of ctx.fleets.all()) {
    const r = raw[f.owner];
    if (!r) continue;
    r.value += unitValue(f.ships, UNIT);
    r.scores.fleet += count(f.ships, SHIPS);
  }
  const total: Record<string, number> = {};
  const categories: Record<string, CategoryScores> = {};
  for (const [id, r] of Object.entries(raw)) {
    total[id] = pointsOf(r.value);
    categories[id] = {
      ...r.scores,
      buildings: pointsOf(r.scores.buildings),
      defense: pointsOf(r.scores.defense),
    };
  }
  return { at: t, total, categories };
}

/** The stored pass of each database, the server's memory. */
const stored = new WeakMap<object, ScorePass>();

/**
 * The stored pass while it holds, else a new one, stored (#405): the state,
 * the guilds and `topPoints` read it.
 */
export function storedScores(ctx: Ctx): ScorePass {
  const pass = stored.get(ctx.db);
  const perDay = roundRules(ctx).highscorePasses;
  if (pass && passHolds(pass.at, ctx.now(), perDay)) return pass;
  const next = scorePass(ctx);
  stored.set(ctx.db, next);
  return next;
}

/**
 * The beat of the clock: the pass of a slot is made at its time, not at the
 * first reader after it. Live (0) waits for a reader.
 */
export function scoreBeat(ctx: Ctx): void {
  if (roundRules(ctx).highscorePasses > 0) storedScores(ctx);
}

/** A new round computes at once (#405). */
export function newScores(ctx: Ctx): void {
  stored.set(ctx.db, scorePass(ctx));
}

/**
 * The exact points of the players of a check, such as the noob protection
 * of an attack: computed now for them alone, never the stored pass (#405).
 */
export const exactPoints = (
  ctx: Ctx,
  ids: readonly string[],
): Record<string, number> => scorePass(ctx, new Set(ids)).total;

/**
 * The points of the best player of the stored pass: the size of the finds of
 * an expedition scales with them (#93, owner, 2026-11-17; #405). 0 without a
 * player.
 */
export const topPoints = (ctx: Ctx): number =>
  Math.max(0, ...Object.values(storedScores(ctx).total));
