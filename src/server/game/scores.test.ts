// The points and the highscore in one pass, N times a day (#405, owner,
// 2026-11-25): the stored pass between two slots, live at most every 10 s,
// the exact points of a check, a fresh pass for a new round, and the one
// pass equal to the two passes before #405 at the same moment.
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { BUILD, RES, SHIPS, UNIT } from '../../core/catalog.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { FIGHTERS } from '../../core/catalog.ts';
import { sumLevels } from '../../core/economy.ts';
import { pointsOf } from '../../core/points.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Levels } from '../../core/types.ts';
import { type Ctx, universe } from './context.ts';

import { reset } from './admin.ts';
import { send } from './fleet-actions.ts';
import { stateFor } from './state.ts';
import {
  SCORES_REVISION,
  exactPoints,
  newScores,
  scoreBeat,
  scorePass,
  storedScores,
  topPoints,
} from './scores.ts';

/** A moment of 2026-11-25 on the clock of the server. */
const at = (h: number, m: number, s = 0): number =>
  new Date(2026, 10, 25, h, m, s).getTime();

function world(perDay: number | null, start = at(7, 0)): TestCtx {
  const ctx = testCtx(start);
  if (perDay !== null)
    ctx.admin.putSettings([['roundHighscorePasses', perDay]]);
  addUser(ctx, 'Anna');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, b: { metal: 10 } });
  return ctx;
}

/** Anna builds more: her points change without the pass knowing. */
function grow(ctx: TestCtx): void {
  const p = ctx.planets.home('u_Anna')!;
  p.b = { ...p.b, metal: (p.b.metal ?? 0) + 10 };
  ctx.planets.save(p);
}

describe('the stored pass (#405)', () => {
  it('runs at 00:05, 08:05 and 16:05 by default; every call in between takes it', () => {
    const ctx = world(null);
    const first = storedScores(ctx);
    expect(first.at).toBe(at(7, 0));
    grow(ctx);
    ctx.clock.t = at(8, 4, 59);
    expect(storedScores(ctx)).toBe(first);
    const state = stateFor(ctx, ctx.players.get('u_Anna')!) as {
      scoresAt: number;
      players: Record<string, { points: number }>;
    };
    expect(state.scoresAt).toBe(at(7, 0));
    expect(state.players.u_Anna!.points).toBe(first.total.u_Anna);
    ctx.clock.t = at(8, 5);
    const second = storedScores(ctx);
    expect(second.at).toBe(at(8, 5));
    expect(second.total.u_Anna).toBeGreaterThan(first.total.u_Anna!);
    ctx.clock.t = at(16, 4);
    expect(storedScores(ctx)).toBe(second);
  });

  it('is made by the clock at its time, without a reader', () => {
    const ctx = world(3);
    scoreBeat(ctx);
    const first = storedScores(ctx);
    ctx.clock.t = at(8, 5, 1);
    scoreBeat(ctx);
    expect(storedScores(ctx).at).toBe(at(8, 5, 1));
    expect(storedScores(ctx)).not.toBe(first);
  });

  it('is made at most every 10 s when live (0), and the clock leaves it to the readers', () => {
    const ctx = world(0, at(12, 0));
    const first = storedScores(ctx);
    grow(ctx);
    ctx.clock.t += 9_999;
    expect(storedScores(ctx)).toBe(first);
    scoreBeat(ctx);
    expect(storedScores(ctx)).toBe(first);
    ctx.clock.t += 1;
    expect(storedScores(ctx).at).toBe(at(12, 0, 10));
  });

  it('follows a change of the setting during the round at once', () => {
    const ctx = world(3, at(9, 0));
    const first = storedScores(ctx);
    ctx.clock.t = at(9, 0, 30);
    ctx.admin.putSettings([['roundHighscorePasses', 0]]);
    expect(storedScores(ctx)).not.toBe(first);
  });

  it('is fresh for a new round and for the archive, and topPoints reads it', () => {
    const ctx = world(3);
    const first = storedScores(ctx);
    grow(ctx);
    ctx.clock.t += 60_000;
    expect(topPoints(ctx)).toBe(first.total.u_Anna);
    newScores(ctx);
    expect(storedScores(ctx).at).toBe(ctx.clock.t);
    expect(topPoints(ctx)).toBeGreaterThan(first.total.u_Anna!);
  });

  it('is made by „Neue Runde“ at once', () => {
    const ctx = world(3);
    const boss = addUser(ctx, 'Boss', { admin: true });
    storedScores(ctx);
    ctx.clock.t = at(7, 10);
    reset(ctx, boss, {});
    // Twenty minutes on, before the next slot: the pass of the new round.
    ctx.clock.t = at(7, 30);
    expect(storedScores(ctx).at).toBe(at(7, 10));
    expect(storedScores(ctx).total).toEqual(scorePass(ctx).total);
  });

  it('drops the pass of a new round whose transaction rolled back (CodeRabbit on #418)', () => {
    const ctx = world(3);
    const boss = addUser(ctx, 'Boss', { admin: true });
    const before = storedScores(ctx);
    expect(before.total.u_Anna).toBeGreaterThan(0);
    ctx.clock.t = at(7, 10);
    // The commit fails after the round was reset and its pass made.
    expect(() =>
      ctx.tx(() => {
        reset(ctx, boss, {});
        throw new Error('SQLITE_FULL');
      }),
    ).toThrow('SQLITE_FULL');
    // The old round is back: its points, not the fresh planets of the new one.
    const now = storedScores(ctx);
    expect(now.total).toEqual(scorePass(ctx).total);
    expect(now.total.u_Anna).toBe(before.total.u_Anna);
  });

  it('drops the pass when a writer outside the server raised the revision', () => {
    const ctx = world(3);
    const first = storedScores(ctx);
    grow(ctx);
    expect(storedScores(ctx)).toBe(first);
    ctx.admin.putSettings([[SCORES_REVISION, 1]]);
    const next = storedScores(ctx);
    expect(next).not.toBe(first);
    expect(next.total.u_Anna).toBeGreaterThan(first.total.u_Anna!);
    expect(storedScores(ctx)).toBe(next);
  });

  it('keeps a pass per database', () => {
    const a = world(3);
    const b = world(3);
    expect(storedScores(a)).not.toBe(storedScores(b));
  });
});

describe('one pass per state (#405, CodeRabbit on #418)', () => {
  /** The passes a state makes: each settles all planets once. */
  function passesOf(perDay: number, moving: boolean): number {
    const ctx = world(perDay, at(12, 0));
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6, b: { metal: 15 } });
    storedScores(ctx);
    // A clock that moves 11 s at every read: a live pass held for no read.
    if (moving) ctx.now = () => (ctx.clock.t += 11_000);
    const all = vi.spyOn(ctx.planets, 'all');
    const state = stateFor(ctx, ctx.players.get('u_Anna')!) as {
      scoresAt: number;
      players: Record<string, { points: number }>;
    };
    expect(state.players.u_Bert!.points).toBeGreaterThan(0);
    return all.mock.calls.length;
  }

  it('reads the stored pass once, so points, categories and „Stand“ are of one pass', () => {
    const held = passesOf(3, false);
    expect(passesOf(0, true) - held).toBe(1);
  });
});

describe('the checks of an action (#405)', () => {
  it('compute the exact points of the two players only', () => {
    const ctx = world(3);
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6, b: { metal: 5 } });
    addUser(ctx, 'Carl');
    addPlanet(ctx, 'u_Carl', { g: 1, s: 3, p: 6, b: { metal: 20 } });
    const all = scorePass(ctx).total;
    expect(exactPoints(ctx, ['u_Anna', 'u_Bert'])).toEqual({
      u_Anna: all.u_Anna,
      u_Bert: all.u_Bert,
    });
  });

  it('protect by the points of now, not by the stored pass', () => {
    const ctx = world(3);
    // Two fleet slots: one for each attack.
    const a = addUser(ctx, 'Attila', { research: { computer: 1 } });
    addPlanet(ctx, a.id, {
      g: 1,
      s: 4,
      p: 5,
      b: { metal: 20 },
      ships: { lf: 10 },
    });
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6, b: { metal: 1 } });
    // The stored pass sees Bert small: under the noob protection then.
    storedScores(ctx);
    const target = ctx.planets.home('u_Bert')!;
    target.b = { metal: 20 };
    ctx.planets.save(target);
    const attack = {
      mission: 'attack',
      ships: { lf: 2 },
      to: { g: 1, s: 2, p: 6 },
      pct: 10,
      cargo: {},
    };
    // Bert has grown since: the attack goes, though the stored pass protects.
    expect(send(ctx, ctx.players.get(a.id)!, attack)).toContain('unterwegs');
    target.b = { metal: 1 };
    ctx.planets.save(target);
    expect(() => send(ctx, ctx.players.get(a.id)!, attack)).toThrow(
      'Noobschutz',
    );
  });
});

describe('the one pass (#405)', () => {
  const levels = (keys: string[]) =>
    fc.dictionary(fc.constantFrom(...keys), fc.integer({ min: 0, max: 12 }), {
      maxKeys: 4,
    });
  const units = (keys: string[]) =>
    fc.dictionary(fc.constantFrom(...keys), fc.integer({ min: 0, max: 50 }), {
      maxKeys: 4,
    });

  it('gives the total and the categories of the two passes before it, at the same moment', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            research: levels(Object.keys(RES)),
            planets: fc.array(
              fc.record({
                b: levels(Object.keys(BUILD)),
                ships: units(Object.keys(SHIPS)),
                def: units(
                  Object.keys(UNIT).filter((k) => !Object.hasOwn(SHIPS, k)),
                ),
              }),
              { maxLength: 3 },
            ),
          }),
          { minLength: 1, maxLength: 4 },
        ),
        (players) => {
          const ctx = testCtx(at(10, 0));
          players.forEach((x, i) => {
            const u = addUser(ctx, `P${i}`, { research: x.research });
            x.planets.forEach((p, j) =>
              addPlanet(ctx, u.id, { g: 1, s: i + 1, p: j + 1, ...p }),
            );
          });
          const pass = scorePass(ctx);
          expect(pass.total).toEqual(pointsMap(ctx));
          expect(pass.categories).toEqual(categoryScores(ctx));
        },
      ),
      { numRuns: 60, seed: 405 },
    );
  });
});

// ----- frozen: the two passes before #405 -----
// src/server/game/points.ts and highscore.ts of main before #405: the one
// pass must give the same at the same moment (the property test above).

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

function pointsMap(ctx: Ctx): Record<string, number> {
  const t = ctx.now();
  const u = universe(ctx);
  const pts: Record<string, number> = {};
  for (const user of ctx.players.all())
    pts[user.id] = levelValue(settleR(user, t).research, RES);
  // Every planet and fleet has an owner (foreign keys of the database).
  for (const p of ctx.planets.all()) {
    const s = settle(p, t, u);
    pts[p.owner] =
      (pts[p.owner] ?? 0) +
      levelValue(s.b, BUILD) +
      unitValue({ ...s.ships, ...s.def }, UNIT);
  }
  // Missiles in flight count until their impact (#54, owiki).
  for (const f of ctx.fleets.all())
    pts[f.owner] = (pts[f.owner] ?? 0) + unitValue(f.ships, UNIT);
  for (const k of Object.keys(pts)) pts[k] = pointsOf(pts[k]!);
  return pts;
}

interface CategoryScores {
  buildings: number;
  research: number;
  fleet: number;
  defense: number;
}

/**
 * The units that fight: a missile does not, and counts only in the total
 * (#54, okf/features/highscore-categories.md). Only the defense of a place is
 * valued with it, and that holds no ship, so the ships of the list stay out.
 */
const DEFENSE: typeof UNIT = Object.fromEntries(
  Object.keys(FIGHTERS).map((k) => [k, UNIT[k]!]),
);

/** The levels or pieces in `have` of the entries of `defs`. */
const count = (have: Levels, defs: Record<string, unknown>): number => {
  let n = 0;
  for (const k of Object.keys(defs)) n += have[k] ?? 0;
  return n;
};

/** The categories of every player, from the same settled state as the total. */
function categoryScores(ctx: Ctx): Record<string, CategoryScores> {
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
