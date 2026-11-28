// The guild points and their „Stand“ (#494, owner, 2026-11-28): the points of
// a guild come from the stored highscore pass, so between two passes they do
// not move, whatever a member builds; the state names that pass with
// `scoresAt`, the same as the highscore, and both move at the next slot.
import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { scoreBeat } from './scores.ts';
import { stateFor } from './state.ts';

/** A moment of 2026-11-25 in UTC; the slots are UTC (149e). */
const at = (h: number, m: number, s = 0): number =>
  Date.UTC(2026, 10, 25, h, m, s);

interface Shown {
  scoresAt: number;
  players: Record<string, { points?: number }>;
  guilds: { directory: { score?: number; members: { points?: number }[] }[] };
}

const shown = (ctx: TestCtx): Shown =>
  stateFor(ctx, ctx.players.get('u_Anna')!) as unknown as Shown;

/** Anna with a mine and the guild „[OR] Outer Rim“, 3 passes a day. */
function world(): TestCtx {
  const ctx = testCtx(at(6, 0));
  ctx.admin.putSettings([['roundHighscorePasses', 3]]);
  addUser(ctx, 'Anna');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, b: { metal: 10 } });
  runAction(ctx, 'u_Anna', {
    type: 'createGuild',
    tag: 'OR',
    name: 'Outer Rim',
    description: '',
  });
  return ctx;
}

/** More points for Anna: a new pass would differ from the stored one. */
function grow(ctx: TestCtx): void {
  const p = ctx.planets.home('u_Anna')!;
  ctx.planets.save({ ...p, b: { ...p.b, metal: p.b.metal! + 10 } });
}

describe('the guild points between two passes (#494)', () => {
  it('stay the same until the next slot, with the „Stand“ of the highscore; then both move', () => {
    const ctx = world();
    const first = shown(ctx);
    const score = first.guilds.directory[0]!.score!;
    expect(score).toBe(first.players.u_Anna!.points);
    // Anna builds, and the state is read again before the slot of 07:05.
    grow(ctx);
    ctx.clock.t = at(6, 30);
    const later = shown(ctx);
    expect(later.guilds.directory[0]!.score).toBe(score);
    expect(later.guilds.directory[0]!.members[0]!.points).toBe(score);
    expect(later.scoresAt).toBe(first.scoresAt);
    // The pass of the slot: the guild points and the „Stand“ move together.
    ctx.clock.t = at(7, 5, 1);
    scoreBeat(ctx);
    const next = shown(ctx);
    expect(next.scoresAt).toBe(at(7, 5, 1));
    expect(next.guilds.directory[0]!.score).toBeGreaterThan(score);
    expect(next.guilds.directory[0]!.score).toBe(next.players.u_Anna!.points);
  });
});
