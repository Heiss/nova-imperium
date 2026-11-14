// „Endzeit“ (#161): the time of one battle of two full gift fleets, measured
// before the merge as the owner asked (2026-11-14). There is no limit; the
// test checks that the battle runs and prints the time it took.
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { giftLevels, giftShips } from '../../core/endzeit.ts';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { tick } from './arrival.ts';

describe('a battle of two full gift fleets', () => {
  it('runs in one arrival; the time is measured', () => {
    const ctx = testCtx();
    const research = giftLevels().r;
    addUser(ctx, 'Anna', { research });
    addUser(ctx, 'Bert', { research });
    const b = giftLevels().b;
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, b, ships: giftShips() });
    const target = addPlanet(ctx, 'u_Bert', {
      g: 1,
      s: 2,
      p: 5,
      b,
      ships: giftShips(),
    });
    const attack: Fleet = {
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: target.id,
      toC: { g: 1, s: 2, p: 5 },
      mission: 'attack',
      ships: giftShips(),
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now(),
      arr: ctx.now() + 1000,
      ret: ctx.now() + 2000,
      state: 'out',
      recalled: false,
      fuel: 0,
    };
    ctx.fleets.save(attack);
    ctx.clock.t += 1000;
    const start = performance.now();
    expect(tick(ctx, () => expect.unreachable())).toBe(1);
    const ms = performance.now() - start;
    const [report] = ctx.reports.ofPlayer('u_Bert');
    expect(report).toMatchObject({
      type: 'battle',
      attBefore: giftShips(),
      defBefore: giftShips(),
    });
    expect(report!.rounds).toBeGreaterThan(0);
    console.info(`#161 battle of two full gift fleets: ${ms.toFixed(0)} ms`);
    expect(ms).toBeGreaterThan(0);
  });
});
