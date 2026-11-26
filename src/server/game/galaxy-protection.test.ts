// The (n) of the Sternenkarte by the rule of an attack (151a, owner,
// 2026-11-26): the state names the protected owners of the system the
// browser shows, by exact points, never the stored pass; without a valid
// system it computes nothing.
import { describe, expect, it, vi } from 'vitest';
import { type TestCtx, addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { send } from './fleet-actions.ts';
import * as scores from './scores.ts';
import { protectedIn, stateFor } from './state.ts';

const PROTECTED = 'Dieser Spieler steht unter Noobschutz.';

/** Anna at [1:1:5] with a fleet; owners of different strength in 1:2. */
function world(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna');
  addPlanet(ctx, 'u_Anna', {
    g: 1,
    s: 1,
    p: 5,
    b: { metal: 20, crystal: 18 },
    ships: { lf: 50 },
    res: { m: 1e6, c: 1e6, d: 1e6 },
  });
  const owners: [string, number, number][] = [
    ['Bert', 1, 1],
    ['Cleo', 22, 6],
    ['Dora', 12, 7],
    ['Emil', 3, 8],
  ];
  for (const [name, metal, p] of owners) {
    addUser(ctx, name);
    addPlanet(ctx, `u_${name}`, { g: 1, s: 2, p, b: { metal } });
  }
  // A second planet of Dora in the system counts once.
  addPlanet(ctx, 'u_Dora', { g: 1, s: 2, p: 9, b: { metal: 1 } });
  // Someone elsewhere is not asked about.
  addUser(ctx, 'Fern');
  addPlanet(ctx, 'u_Fern', { g: 2, s: 2, p: 4 });
  return ctx;
}

/** Whether an attack of Anna on the planet at [1:2:p] is refused for the noob protection. */
function attackRefused(ctx: TestCtx, p: number): boolean {
  try {
    send(ctx, ctx.players.get('u_Anna')!, {
      mission: 'attack',
      ships: { lf: 1 },
      to: { g: 1, s: 2, p },
      pct: 100,
      cargo: {},
    });
    // The slot is free again for the next owner.
    ctx.db.prepare('DELETE FROM fleets').run();
    return false;
  } catch (e) {
    if ((e as Error).message === PROTECTED) return true;
    throw e;
  }
}

describe('the noob protection of the shown system (151a)', () => {
  it('names exactly the owners an attack refuses, by exact points', () => {
    const ctx = world();
    // The stored pass is made now; then Emil builds up past a fifth of Anna.
    scores.storedScores(ctx);
    const emil = ctx.planets.home('u_Emil')!;
    emil.b = { metal: 20 };
    ctx.planets.save(emil);
    const list = protectedIn(ctx, 'u_Anna', { g: 1, s: 2 });
    expect(list.g).toBe(1);
    expect(list.s).toBe(2);
    const refused = [
      ['u_Bert', 1],
      ['u_Cleo', 6],
      ['u_Dora', 7],
      ['u_Emil', 8],
    ]
      .filter(([, p]) => attackRefused(ctx, Number(p)))
      .map(([id]) => id);
    expect(list.owners.sort()).toEqual(refused.sort());
    // Both kinds are there: some protected, some not, and Emil by his
    // exact points, not by the stored pass.
    expect(refused).toContain('u_Bert');
    expect(refused).not.toContain('u_Cleo');
    expect(refused).not.toContain('u_Emil');
    const stored = scores.storedScores(ctx).total;
    expect(stored.u_Emil! * 5).toBeLessThan(stored.u_Anna!);
  });

  it('lists each owner once, never the player, only owners of that system, and computes nothing for an empty one', () => {
    const ctx = world();
    addPlanet(ctx, 'u_Anna', { g: 1, s: 2, p: 12 });
    // Weak owners in the same galaxy and in the same system number elsewhere.
    addUser(ctx, 'Gina');
    addPlanet(ctx, 'u_Gina', { g: 1, s: 3, p: 4 });
    const { owners } = protectedIn(ctx, 'u_Anna', { g: 1, s: 2 });
    expect(owners).not.toContain('u_Anna');
    expect(owners).not.toContain('u_Fern');
    expect(owners).not.toContain('u_Gina');
    expect(new Set(owners).size).toBe(owners.length);
    expect(protectedIn(ctx, 'u_Anna', { g: 2, s: 2 }).owners).toEqual([
      'u_Fern',
    ]);
    const exact = vi.spyOn(scores, 'exactPoints');
    expect(protectedIn(ctx, 'u_Anna', { g: 3, s: 9 })).toEqual({
      g: 3,
      s: 9,
      owners: [],
    });
    // A system of the player alone is empty too.
    addPlanet(ctx, 'u_Anna', { g: 1, s: 4, p: 2 });
    expect(protectedIn(ctx, 'u_Anna', { g: 1, s: 4 }).owners).toEqual([]);
    expect(exact).not.toHaveBeenCalled();
    exact.mockRestore();
  });

  it('is in the state only with a valid system, and computes nothing without one', () => {
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    const exact = vi.spyOn(scores, 'exactPoints');
    // As the browser gets it: a key without a value is not sent.
    const sent = (shown: unknown) =>
      JSON.parse(
        JSON.stringify(stateFor(ctx, anna, undefined, undefined, shown)),
      );
    for (const shown of [undefined, '', '0:2', '1:9999', '1:2:3', 'x', 12])
      expect(sent(shown)).not.toHaveProperty('protectedOwners');
    expect(exact).not.toHaveBeenCalled();
    const state = stateFor(ctx, anna, undefined, undefined, '1:2');
    expect(state.protectedOwners).toEqual(
      protectedIn(ctx, 'u_Anna', { g: 1, s: 2 }),
    );
    expect(exact).toHaveBeenCalled();
    exact.mockRestore();
  });
});
