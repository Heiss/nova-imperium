// The categories of the highscore besides the total (#78): buildings and
// defense at 1 point per 1,000 resources (D5), fleet and research by count,
// 1 per ship and 1 per research level, as in classic (Q1, owiki
// „Statistik“). The total stays `pointsMap` of points.ts.
import { BUILD, FIGHTERS, RES, SHIPS, UNIT } from '../../core/catalog.ts';
import { pointsOf } from '../../core/points.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Levels } from '../../core/types.ts';
import { type Ctx, universe } from './context.ts';
import { levelValue, unitValue } from './points.ts';

export interface CategoryScores {
  buildings: number;
  research: number;
  fleet: number;
  defense: number;
}

/**
 * The defense that fights: a missile does not, and counts only in the total
 * (#54, okf/features/highscore-categories.md).
 */
const DEFENSE: typeof UNIT = Object.fromEntries(
  Object.entries(FIGHTERS)
    .filter(([, f]) => f.kind === 'defense')
    .map(([k]) => [k, UNIT[k]!]),
);

/** The levels or pieces in `have` of the entries of `defs`. */
const count = (have: Levels, defs: Record<string, unknown>): number => {
  let n = 0;
  for (const k of Object.keys(defs)) n += have[k] ?? 0;
  return n;
};

/** The categories of every player, from the same settled state as the total. */
export function categoryScores(ctx: Ctx): Record<string, CategoryScores> {
  const t = ctx.now();
  const u = universe(ctx);
  const raw: Record<string, CategoryScores> = {};
  for (const user of ctx.players.all())
    raw[user.id] = {
      buildings: 0,
      research: count(settleR(user, t).research, RES),
      fleet: 0,
      defense: 0,
    };
  // Every planet and fleet has an owner (foreign keys of the database).
  for (const p of ctx.planets.all()) {
    const s = settle(p, t, u);
    const c = raw[p.owner]!;
    c.buildings += levelValue(s.b, BUILD);
    c.fleet += count(s.ships, SHIPS);
    c.defense += unitValue(s.def, DEFENSE);
  }
  for (const f of ctx.fleets.all())
    raw[f.owner]!.fleet += count(f.ships, SHIPS);
  for (const c of Object.values(raw)) {
    c.buildings = pointsOf(c.buildings);
    c.defense = pointsOf(c.defense);
  }
  return raw;
}
