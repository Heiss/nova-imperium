// The points and the highscore categories of every player in one pass
// (#405, owner, 2026-11-25): a pass loads every player, planet and fleet and
// settles each planet once, for the total and the categories together. The
// state, the guilds and the finds of an expedition take the stored pass,
// made N times a day by the clock of the server, or at most every 10 s with
// N = 0 (core/highscore-passes.ts); a check of an action computes the exact
// points of its two players (`exactPoints`), the archive of a round a fresh
// pass. The newest pass is kept in the memory of the server and in the
// database (`score_pass`, owner, 2026-11-28, #491): a restart reads it, shows
// the same highscore and „Stand“, and makes the next pass at its scheduled
// time; with no stored pass (a new round, the first start after #491) the
// first reader or the clock makes one as before.
import { BUILD, RES } from '../../core/catalog.ts';
import {
  addUnits,
  type CategoryTally,
  type Tally,
} from '../../core/highscore-categories.ts';
import { passHolds, roundSettings } from '../../core/highscore-passes.ts';
import { pointsOf } from '../../core/points.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Levels } from '../../core/types.ts';
import { type Ctx, universe } from './context.ts';
import { recheckHolds } from './holding.ts';
import { sumLevels } from '../../core/economy.ts';

/** A category in both of its modes (#422): by number and by points. */
interface CategoryValue {
  /** „Anzahl“: pieces and levels. */
  count: number;
  /** „Rohstoffe“: the resources spent, 1 point per 1,000. */
  points: number;
}

/** Wirtschaft and Militär of a player (#422, core/highscore-categories.ts). */
export interface CategoryScores {
  economy: CategoryValue;
  military: CategoryValue;
}

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

/** The levels of `have` over the entries of `defs`. */
const count = (have: Levels, defs: Record<string, unknown>): number => {
  let n = 0;
  for (const k of Object.keys(defs)) n += have[k] ?? 0;
  return n;
};

const tally = (): Tally => ({ count: 0, value: 0 });

const valueOf = (t: Tally): CategoryValue => ({
  count: t.count,
  points: pointsOf(t.value),
});

/**
 * One pass now, over every player or only the players of `only`: each
 * planet is settled once for the total and the categories. The total is
 * all resources spent / 1,000, as before (#422: Gesamt unchanged); it is the
 * resources of Wirtschaft and Militär together.
 */
export function scorePass(ctx: Ctx, only?: ReadonlySet<string>): ScorePass {
  const t = ctx.now();
  const u = universe(ctx);
  const takes = (id: string): boolean => !only || only.has(id);
  const raw: Record<string, CategoryTally> = {};
  for (const user of ctx.players.all()) {
    if (!takes(user.id)) continue;
    const research = settleR(user, t).research;
    raw[user.id] = {
      economy: {
        count: count(research, RES),
        value: levelValue(research, RES),
      },
      military: tally(),
    };
  }
  // Every planet and fleet has an owner (foreign keys of the database).
  const planets = only
    ? [...only].flatMap((id) => ctx.planets.ofOwner(id))
    : ctx.planets.all();
  for (const p of planets) {
    const s = settle(p, t, u);
    const r = raw[p.owner]!;
    r.economy.count += count(s.b, BUILD);
    r.economy.value += levelValue(s.b, BUILD);
    addUnits(r, { ...s.ships, ...s.def });
  }
  // Ships and missiles in flight count until they are back or hit (#54, owiki).
  for (const f of ctx.fleets.all()) {
    const r = raw[f.owner];
    if (r) addUnits(r, f.ships);
  }
  const total: Record<string, number> = {};
  const categories: Record<string, CategoryScores> = {};
  for (const [id, r] of Object.entries(raw)) {
    total[id] = pointsOf(r.economy.value + r.military.value);
    categories[id] = {
      economy: valueOf(r.economy),
      military: valueOf(r.military),
    };
  }
  return { at: t, total, categories };
}

/**
 * „Highscore-Aktualisierungen pro Tag“ of the round: the one setting, not
 * every rule of the round, since the clock asks for it every second.
 */
const passesPerDay = (ctx: Ctx): number =>
  ctx.admin.setting(roundSettings[0].key) ?? roundSettings[0].def;

/**
 * The stored pass of each database, the server's memory, with the start of
 * the round it was made in. A new round makes its pass inside its
 * transaction; should that transaction roll back, the stored start of the
 * round is the old one again and the pass is not taken (CodeRabbit on #418).
 */
const stored = new WeakMap<object, { pass: ScorePass; round: string }>();

/**
 * A writer outside the server (the seed of the E2E tests, a repair by
 * hand) raises this setting after it changed points: the stored pass of the
 * running server is then not taken.
 */
export const SCORES_REVISION = 'scoresRevision';

/** What a stored pass must still match: the start of the round and the revision. */
const roundOf = (ctx: Ctx): string =>
  `${ctx.admin.setting('roundStart') ?? '-'}/${ctx.admin.setting(SCORES_REVISION) ?? 0}`;

/** The pass as the database keeps it: its time is a column of its own. */
type StoredScores = Omit<ScorePass, 'at'>;

/** The pass the database keeps (#491), as the memory keeps it; none without a row. */
function fromDatabase(ctx: Ctx): { pass: ScorePass; round: string } | null {
  const row = ctx.scorePasses.get<StoredScores>();
  return row && { round: row.round, pass: { ...row.pass, at: row.at } };
}

/** Keeps a new pass in the memory and in the database (#491). */
function keep(ctx: Ctx, pass: ScorePass, round: string): void {
  stored.set(ctx.db, { pass, round });
  const { at, ...scores } = pass;
  ctx.scorePasses.save<StoredScores>({ round, at, pass: scores });
}

/**
 * The stored pass while it holds, else a new one, stored (#405): the state,
 * the guilds and `topPoints` read it. After a restart the memory is empty
 * and the pass of the database is taken while it holds (#491).
 */
export function storedScores(ctx: Ctx): ScorePass {
  const kept = stored.get(ctx.db) ?? fromDatabase(ctx);
  const round = roundOf(ctx);
  if (
    kept &&
    kept.round === round &&
    passHolds(kept.pass.at, ctx.now(), passesPerDay(ctx))
  ) {
    stored.set(ctx.db, kept);
    return kept.pass;
  }
  const pass = scorePass(ctx);
  keep(ctx, pass, round);
  return pass;
}

/** The pass after which the running holds were last checked, by database (#440). */
const checkedAt = new WeakMap<object, number>();

/**
 * The beat of the clock: the pass of a slot is made at its time, not at the
 * first reader after it. Live (0) waits for a reader. Once per pass, whoever
 * made it, the beat checks every running hold again (#440) in one write
 * transaction: a change that no action names still turns a hold home at the
 * latest there; a read of the state never ends a hold.
 */
export function scoreBeat(ctx: Ctx): void {
  if (passesPerDay(ctx) === 0) return;
  const { at } = storedScores(ctx);
  if (checkedAt.get(ctx.db) === at) return;
  ctx.tx(() => recheckHolds(ctx));
  checkedAt.set(ctx.db, at);
}

/** A new round computes at once (#405), for the start it just stored, in its transaction. */
export function newScores(ctx: Ctx): void {
  keep(ctx, scorePass(ctx), roundOf(ctx));
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
