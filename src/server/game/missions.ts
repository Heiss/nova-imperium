// What the arrivals of the missions share (owner, 2026-11-14, #116): the
// arrival a mission gets from the dispatcher in arrival.ts, and the moves of
// a fleet. Each src/features/missions/<m>/arrive.server.ts exports its
// `onArrive`; only src/server imports their index (index.server.gen.ts).
import { settleR } from '../../core/settle.ts';
import type { Fleet, Levels, Planet, Resources } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';

/** A player as an arrival sees them: an unknown owner has no research. */
export type Player = Pick<User, 'name' | 'research' | 'rq'>;

/** The target of a mission that flies to a planet, settled to the arrival. */
export interface Arrival {
  t: Planet;
  att: Player;
  def: Player;
}

/** The server part of a mission (its arrive.server.ts). */
export interface MissionServer {
  /**
   * What the fleet does at its target. A free target (`target: 'free'`) gets
   * no arrival, because nothing is there, and so does a Trümmerfeld
   * (`target: 'debris'`, #45), which is no planet; every other kind gets the
   * settled planet and both players.
   */
  onArrive(ctx: Ctx, f: Fleet, at: Arrival | null): void;
}

const techAt = (p: Player, t: number): Levels => settleR(p, t).research;

/** The research of the attacker and of the defender at a time. */
export const researchAt = (
  { att, def }: Arrival,
  t: number,
): { attR: Levels; defR: Levels } => ({
  attR: techAt(att, t),
  defR: techAt(def, t),
});

/** The fleet flies home, with the changes of its arrival. */
export function turnBack(
  ctx: Ctx,
  f: Fleet,
  change: Partial<Fleet> = {},
): void {
  Object.assign(f, change, { state: 'back' });
  ctx.fleets.save(f);
}

/** Puts ships and cargo onto a planet, also above its storage limit. */
export function land(p: Planet, ships: Levels, cargo: Resources): void {
  for (const [k, n] of Object.entries(ships))
    p.ships[k] = (p.ships[k] ?? 0) + n;
  p.res.m += cargo.m;
  p.res.c += cargo.c;
  p.res.d += cargo.d;
}
