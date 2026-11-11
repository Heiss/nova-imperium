// Points: 1 point per 1,000 resources in buildings, research, ships and defense.
import { BUILD, RES, SHIPS, UNIT } from '../../shared/catalog.ts';
import { sumLevels } from '../../shared/economy.ts';
import { isProtected as protects } from '../../shared/protection.ts';
import { settle, settleR } from '../../shared/settle.ts';
import type { Levels } from '../../shared/types.ts';
import { type Ctx, universe } from './context.ts';

const unitValue = (units: Levels, defs: typeof UNIT): number => {
  let s = 0;
  for (const [k, n] of Object.entries(units)) {
    const d = defs[k];
    if (d) s += (d.cost[0] + d.cost[1] + d.cost[2]) * n;
  }
  return s;
};

const levelValue = (have: Levels, defs: typeof BUILD | typeof RES): number => {
  let s = 0;
  for (const k of Object.keys(defs)) s += sumLevels(defs[k]!, have[k] ?? 0);
  return s;
};

export function pointsMap(ctx: Ctx): Record<string, number> {
  const t = ctx.now();
  const u = universe(ctx);
  const pts: Record<string, number> = {};
  for (const user of ctx.store.users())
    pts[user.id] = levelValue(settleR(user, t).research, RES);
  // Every planet and fleet has an owner (foreign keys of the database).
  for (const p of ctx.store.planets()) {
    const s = settle(p, t, u);
    pts[p.owner] =
      (pts[p.owner] ?? 0) +
      levelValue(s.b, BUILD) +
      unitValue({ ...s.ships, ...s.def }, UNIT);
  }
  for (const f of ctx.store.fleets())
    pts[f.owner] = (pts[f.owner] ?? 0) + unitValue(f.ships, SHIPS);
  for (const k of Object.keys(pts)) pts[k] = Math.floor(pts[k]! / 1000);
  return pts;
}

/** Noob protection: a player with less than a fifth of your points. */
export const isProtected = (
  me: string,
  target: string,
  pts: Record<string, number>,
): boolean => protects(pts[me] ?? 0, pts[target] ?? 0);
