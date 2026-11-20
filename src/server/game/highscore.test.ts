// The categories of the highscore (#78): buildings and defense at 1 point
// per 1,000 resources, fleet and research by count, as in classic (Q1).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { categoryScores } from './highscore.ts';
import { pointsMap } from './points.ts';

const fleet = (owner: string, ships: Record<string, number>): Fleet => ({
  id: `f_${owner}_${Object.keys(ships).join('_')}`,
  owner,
  from: 'a',
  fromC: { g: 1, s: 1, p: 1 },
  to: 'b',
  toC: { g: 1, s: 1, p: 2 },
  mission: 'attack',
  ships,
  cargo: { m: 0, c: 0, d: 0 },
  dep: 0,
  arr: 9e12,
  ret: 9e12,
  state: 'out',
  recalled: false,
  fuel: 0,
});

describe('the categories of the highscore (#78)', () => {
  it('are 0 for a player without planets, research or fleets', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(categoryScores(ctx)).toEqual({
      u_Anna: { buildings: 0, research: 0, fleet: 0, defense: 0 },
    });
  });

  it('count buildings per 1,000 resources over all planets and moons', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    // metal 1 to 10: 60 × (1.5^10 − 1) / 0.5 + 15 × … = 6,800 + 1,700
    addPlanet(ctx, 'u_Anna', { b: { metal: 10 } });
    addPlanet(ctx, 'u_Anna', {
      id: 'm1_1_9',
      kind: 'moon',
      g: 1,
      s: 1,
      p: 9,
      b: { robot: 1 },
    });
    const c = categoryScores(ctx).u_Anna!;
    // robot 1: 400 + 120 + 200 = 720; 8,500 + 720 = 9,220
    expect(c.buildings).toBe(9);
    expect(c.defense).toBe(0);
  });

  it('count the Handelsposten and the Raketenkrypta in the buildings like every building (#171, #54)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    // Handelsposten 5,000 + 10,000 + 5,000 = 20,000 on level 1, 40,000 more
    // on level 2 (factor 2); Raketenkrypta 20,000 + 20,000 + 1,000 = 41,000.
    addPlanet(ctx, 'u_Anna', { b: { market: 2 } });
    addPlanet(ctx, 'u_Bert', { g: 1, s: 1, p: 6, b: { silo: 1 } });
    const c = categoryScores(ctx);
    expect(c.u_Anna).toEqual({
      buildings: 60,
      research: 0,
      fleet: 0,
      defense: 0,
    });
    expect(c.u_Bert).toEqual({
      buildings: 41,
      research: 0,
      fleet: 0,
      defense: 0,
    });
    // The total counts the same cost (1 point per 1,000 resources).
    expect(pointsMap(ctx).u_Anna).toBe(60);
    expect(pointsMap(ctx).u_Bert).toBe(41);
  });

  it('count research by its levels, not by its cost (Q1)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 3, graviton: 1, laser: 2 } });
    expect(categoryScores(ctx).u_Anna!.research).toBe(6);
  });

  it('count a finished research level, not a running one', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', {
      research: { energy: 1 },
      rq: {
        key: 'energy',
        lvl: 2,
        start: ctx.now(),
        end: ctx.now() + 1000,
        cost: [0, 800, 400],
      },
    });
    expect(categoryScores(ctx).u_Anna!.research).toBe(1);
    ctx.clock.t += 1000;
    expect(categoryScores(ctx).u_Anna!.research).toBe(2);
  });

  it('count every ship as 1, at home and in flight, Sonnenreliquiare too (Q1)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', {
      ships: { dstar: 1, sat: 4, probe: 2 },
      def: { rl: 7 },
    });
    ctx.fleets.save(fleet('u_Anna', { lf: 3, xx: 5 }));
    const c = categoryScores(ctx).u_Anna!;
    expect(c.fleet).toBe(10);
    expect(c.defense).toBe(14);
  });

  it('count defense per 1,000 resources and leave ships out of it', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { ships: { bs: 2 }, def: { lsd: 1, rl: 1 } });
    // lsd 100,000 + rl 2,000 = 102,000
    expect(categoryScores(ctx).u_Anna!.defense).toBe(102);
  });

  it('leave missiles out of the defense (#54)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    // The orbital missile costs 25,000 and does not fight.
    addPlanet(ctx, 'u_Anna', { def: { rl: 1, ipm: 3 } });
    expect(categoryScores(ctx).u_Anna!.defense).toBe(2);
  });

  it('round each category down', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { b: { metal: 1 }, def: { rl: 1, ll: 1 } });
    // metal 75; rl 2,000 + ll 2,000 = 4,000
    expect(categoryScores(ctx).u_Anna).toEqual({
      buildings: 0,
      research: 0,
      fleet: 0,
      defense: 4,
    });
  });

  it('keep the players apart', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 2 } });
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { ships: { lf: 2 } });
    ctx.fleets.save(fleet('u_Bert', { sc: 1 }));
    expect(categoryScores(ctx)).toEqual({
      u_Anna: { buildings: 0, research: 2, fleet: 0, defense: 0 },
      u_Bert: { buildings: 0, research: 0, fleet: 3, defense: 0 },
    });
  });

  it('leave the total and so the noob protection as they are (D5)', () => {
    fc.assert(
      fc.property(
        fc.nat(5),
        fc.nat(4),
        fc.nat(9),
        fc.nat(9),
        fc.nat(9),
        (metal, energy, lf, rl, flying) => {
          const ctx = testCtx();
          addUser(ctx, 'Anna', { research: { energy } });
          addPlanet(ctx, 'u_Anna', {
            b: { metal },
            ships: { lf },
            def: { rl },
          });
          if (flying) ctx.fleets.save(fleet('u_Anna', { lf: flying }));
          const before = pointsMap(ctx);
          const c = categoryScores(ctx).u_Anna!;
          expect(pointsMap(ctx)).toEqual(before);
          expect(c.fleet).toBe(lf + flying);
          expect(c.research).toBe(energy);
          expect(c.defense).toBe(Math.floor((rl * 2000) / 1000));
        },
      ),
      { seed: 78 },
    );
  });
});
