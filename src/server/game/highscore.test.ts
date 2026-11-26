// The categories of the highscore (#422, owner, 2026-11-26): Wirtschaft
// (buildings, research, Sonnenreliquiare) and Militär (ships, defense,
// missiles), each by number („Anzahl“) and by the resources spent / 1,000
// („Rohstoffe“); Gesamt stays all resources / 1,000. They replace the four
// categories of #78 (160a).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { categoryScores } from './highscore.ts';
import { pointsMap } from './points.ts';
import { stateFor } from './state.ts';
import { runAction } from './dispatch.ts';

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

/** A category: its number and its points. */
const v = (count: number, points: number) => ({ count, points });

describe('the categories of the highscore (#422)', () => {
  it('are 0 for a player without planets, research or fleets', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(categoryScores(ctx)).toEqual({
      u_Anna: { economy: v(0, 0), military: v(0, 0) },
    });
  });

  it('count every building level of all planets and moons to Wirtschaft, by number and per 1,000 resources', () => {
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
    // robot 1: 400 + 120 + 200 = 720; 8,500 + 720 = 9,220
    expect(categoryScores(ctx).u_Anna).toEqual({
      economy: v(11, 9),
      military: v(0, 0),
    });
  });

  it('count the Handelsposten and the Raketenkrypta like every building (#171, #54)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    // Handelsposten 5,000 + 10,000 + 5,000 = 20,000 on level 1, 40,000 more
    // on level 2 (factor 2); Raketenkrypta 20,000 + 20,000 + 1,000 = 41,000.
    addPlanet(ctx, 'u_Anna', { b: { market: 2 } });
    addPlanet(ctx, 'u_Bert', { g: 1, s: 1, p: 6, b: { silo: 1 } });
    const c = categoryScores(ctx);
    expect(c.u_Anna).toEqual({ economy: v(2, 60), military: v(0, 0) });
    expect(c.u_Bert).toEqual({ economy: v(1, 41), military: v(0, 0) });
    // The total counts the same cost (1 point per 1,000 resources).
    expect(pointsMap(ctx).u_Anna).toBe(60);
    expect(pointsMap(ctx).u_Bert).toBe(41);
  });

  it('count research by its levels, and by its cost in the resources', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 3, graviton: 1, laser: 2 } });
    const c = categoryScores(ctx).u_Anna!;
    expect(c.economy.count).toBe(6);
    // Research only: Wirtschaft by resources is the total.
    expect(c.economy.points).toBe(pointsMap(ctx).u_Anna);
    expect(c.economy.points).toBeGreaterThan(0);
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
    expect(categoryScores(ctx).u_Anna!.economy.count).toBe(1);
    ctx.clock.t += 1000;
    expect(categoryScores(ctx).u_Anna!.economy.count).toBe(2);
  });

  it('count ships at home and in flight and the defense to Militär, Sonnenreliquiare to Wirtschaft (160a)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', {
      ships: { dstar: 1, sat: 4, probe: 2 },
      def: { rl: 7 },
    });
    // An unknown key counts nowhere.
    ctx.fleets.save(fleet('u_Anna', { lf: 3, xx: 5 }));
    // dstar 10,000,000 + probe 2,000 + rl 14,000 + lf 12,000; sat 4 × 2,500.
    expect(categoryScores(ctx).u_Anna).toEqual({
      economy: v(4, 10),
      military: v(13, 10_028),
    });
  });

  it('counts 10 ships and 13 defense units as 23 in Militär by number (the owner’s example)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { ships: { lf: 6, sc: 4 }, def: { rl: 13 } });
    expect(categoryScores(ctx).u_Anna!.military.count).toBe(23);
  });

  it('count defense per 1,000 resources with the ships', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { ships: { bs: 2 }, def: { lsd: 1, rl: 1 } });
    // bs 2 × 60,000 + lsd 100,000 + rl 2,000 = 222,000
    expect(categoryScores(ctx).u_Anna!.military).toEqual(v(4, 222));
  });

  it('count missiles to Militär, at home and in flight (160a)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    // The orbital missile costs 25,000.
    addPlanet(ctx, 'u_Anna', { def: { rl: 1, ipm: 3 } });
    ctx.fleets.save({ ...fleet('u_Anna', { ipm: 2 }), mission: 'missile' });
    // rl 2,000 + 5 × 25,000 = 127,000
    expect(categoryScores(ctx).u_Anna!.military).toEqual(v(6, 127));
  });

  it('round each category down', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { b: { metal: 1 }, def: { rl: 1, ll: 1 } });
    // metal 75; rl 2,000 + ll 2,000 = 4,000
    expect(categoryScores(ctx).u_Anna).toEqual({
      economy: v(1, 0),
      military: v(2, 4),
    });
  });

  it('keep the players apart', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 2 } });
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { ships: { lf: 2 } });
    ctx.fleets.save(fleet('u_Bert', { sc: 1 }));
    const c = categoryScores(ctx);
    expect(c.u_Anna!.economy.count).toBe(2);
    expect(c.u_Anna!.military).toEqual(v(0, 0));
    expect(c.u_Bert).toEqual({ economy: v(0, 0), military: v(3, 12) });
  });

  it('leave the total and so the noob protection as they are: Gesamt is all resources / 1,000', () => {
    fc.assert(
      fc.property(
        fc.nat(5),
        fc.nat(4),
        fc.nat(9),
        fc.nat(9),
        fc.nat(9),
        fc.nat(3),
        (metal, energy, lf, rl, flying, sat) => {
          const ctx = testCtx();
          addUser(ctx, 'Anna', { research: { energy } });
          addPlanet(ctx, 'u_Anna', {
            b: { metal },
            ships: { lf, sat },
            def: { rl },
          });
          if (flying) ctx.fleets.save(fleet('u_Anna', { lf: flying }));
          const total = pointsMap(ctx).u_Anna!;
          const c = categoryScores(ctx).u_Anna!;
          expect(c.military.count).toBe(lf + flying + rl);
          expect(c.economy.count).toBe(metal + energy + sat);
          expect(c.military.points).toBe(
            Math.floor(((lf + flying) * 4000 + rl * 2000) / 1000),
          );
          // Each category is rounded down on its own: together they are
          // the total or one less.
          const sum = c.economy.points + c.military.points;
          expect(total - sum).toBeGreaterThanOrEqual(0);
          expect(total - sum).toBeLessThanOrEqual(1);
        },
      ),
      { seed: 78 },
    );
  });
});

describe('Wirtschaft and Militär in the state (#422)', () => {
  /** Anna: metal 10 and research energy 2; 4 ships, 3 defense units, 2 missiles. */
  function world() {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 2 } });
    addPlanet(ctx, 'u_Anna', {
      b: { metal: 10 },
      ships: { lf: 4, sat: 1 },
      def: { rl: 3, ipm: 2 },
    });
    return ctx;
  }
  const shown = (ctx: ReturnType<typeof world>) =>
    (
      stateFor(ctx, ctx.players.get('u_Anna')!) as {
        players: Record<string, { points: number; scores: unknown }>;
      }
    ).players.u_Anna!;

  it('shows them by number by default, and only them', () => {
    const ctx = world();
    const anna = shown(ctx);
    // 10 + 2 levels + 1 Sonnenreliquiar; 4 ships + 3 + 2 missiles.
    expect(anna.scores).toEqual({ economy: 13, military: 9 });
    expect(anna.points).toBe(pointsMap(ctx).u_Anna);
    const sent = JSON.stringify(stateFor(ctx, ctx.players.get('u_Anna')!));
    for (const old of ['buildings', 'fleet', 'defense']) {
      expect(sent).not.toContain(`"${old}":`);
    }
  });

  it('shows each in the mode the round sets now, from the same pass', () => {
    const ctx = world();
    const c = categoryScores(ctx).u_Anna!;
    ctx.admin.putSettings([['roundHighscoreMilitary', 1]]);
    expect(shown(ctx).scores).toEqual({
      economy: c.economy.count,
      military: c.military.points,
    });
    ctx.admin.putSettings([
      ['roundHighscoreEconomy', 1],
      ['roundHighscoreMilitary', 0],
    ]);
    expect(shown(ctx).scores).toEqual({
      economy: c.economy.points,
      military: c.military.count,
    });
    // Gesamt does not change with the modes.
    expect(shown(ctx).points).toBe(pointsMap(ctx).u_Anna);
  });
});

describe('„Highscore zeigt“ in the state (#422, 175a to 182a)', () => {
  /** Anna and Bert with points; a guild of both. */
  function world() {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 2 } });
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Anna', { b: { metal: 10 }, ships: { lf: 4 } });
    addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6, b: { metal: 12 } });
    runAction(ctx, 'u_Anna', {
      type: 'createGuild',
      name: 'Outer Rim',
      tag: 'or',
      description: '',
    });
    return ctx;
  }
  const state = (ctx: ReturnType<typeof world>) =>
    JSON.parse(JSON.stringify(stateFor(ctx, ctx.players.get('u_Anna')!))) as {
      players: Record<string, Record<string, unknown>>;
      guilds: { directory: Record<string, unknown>[] };
    };
  const shows = (ctx: ReturnType<typeof world>, value: number) =>
    ctx.admin.putSettings([['roundHighscoreShows', value]]);

  it('sends every category by default', () => {
    const ctx = world();
    const s = state(ctx);
    for (const id of ['u_Anna', 'u_Bert']) {
      expect(s.players[id]).toHaveProperty('points');
      expect(s.players[id]).toHaveProperty('scores');
    }
    expect(s.guilds.directory[0]).toHaveProperty('score');
  });

  it('sends the total only with „nur Gesamt“, and the guild as before (177a)', () => {
    const ctx = world();
    shows(ctx, 1);
    const s = state(ctx);
    expect(s.players.u_Bert).toEqual({
      name: 'Bert',
      points: pointsMap(ctx).u_Bert,
    });
    expect(s.players.u_Anna).not.toHaveProperty('scores');
    expect(s.guilds.directory[0]).toMatchObject({
      score: pointsMap(ctx).u_Anna,
      members: [{ id: 'u_Anna', name: 'Anna', points: pointsMap(ctx).u_Anna }],
    });
  });

  it('sends no points, rank or category of another player with „nichts“, the own points only (176a, 182a)', () => {
    const ctx = world();
    shows(ctx, 2);
    const s = state(ctx);
    expect(s.players.u_Bert).toEqual({ name: 'Bert' });
    expect(s.players.u_Anna).toEqual({
      name: 'Anna',
      points: pointsMap(ctx).u_Anna,
    });
    // No points of the members and no sums of them in the guild.
    expect(s.guilds.directory[0]).toEqual({
      id: s.guilds.directory[0]!.id,
      tag: 'OR',
      name: 'Outer Rim',
      html: '',
      members: [{ id: 'u_Anna', name: 'Anna' }],
    });
    // The noob protection and the total stay computed in full.
    expect(pointsMap(ctx).u_Bert).toBeGreaterThan(0);
  });

  it('takes effect at once, from the same pass', () => {
    const ctx = world();
    const at = state(ctx);
    shows(ctx, 2);
    expect(state(ctx).players.u_Bert).toEqual({ name: 'Bert' });
    shows(ctx, 0);
    expect(state(ctx).players.u_Bert).toEqual(at.players.u_Bert);
  });
});
