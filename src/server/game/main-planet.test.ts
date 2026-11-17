// The main planet (#221, owner, 2026-11-16): the switch in the options with
// its lock (D3 to D5), the fallback (D6), what it decides (navigation and
// research, D1) and what stays with the first planet (rewards, Endzeit).
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/main-planet.ts';
import type { Planet } from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, type TestCtx, testCtx } from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import {
  MAIN_ERROR,
  lockEndText,
  lockedText,
  mainPlanet,
  mainPlanetOf,
  mainPlanetView,
} from './main-planet.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';

// 2026-11-16 12:00 UTC.
const START = Date.UTC(2026, 10, 16, 12, 0);

/** Anna (admin) with her first planet, a later colony and a moon; Bert with his first planet. */
function world(): TestCtx {
  const ctx = testCtx(START);
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, name: 'Heim' });
  ctx.clock.t += 1;
  addPlanet(ctx, 'u_Anna', { g: 2, s: 3, p: 7, name: 'Kolonie' });
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, kind: 'moon', id: 'm1_1_5' });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 5, name: 'Bertheim' });
  return ctx;
}

const choose = (ctx: TestCtx, main: unknown, uid = 'u_Anna') =>
  runAction(ctx, uid, { type: 'mainPlanet', main });

const anna = (ctx: TestCtx) => ctx.players.get('u_Anna')!;

type Shown = {
  planet: Planet | null;
  homePlanet: string | null;
  mainPlanet: string | null;
  mainLock: number | null;
  round: { mainLock: number };
};
const shown = (ctx: TestCtx, selected?: unknown) =>
  stateFor(ctx, anna(ctx), selected) as unknown as Shown;

describe('choosing the main planet', () => {
  it('is the first planet without a choice, unlocked', () => {
    const ctx = world();
    expect(mainPlanetOf(ctx, anna(ctx))).toEqual({
      planet: ctx.planets.get('p1_1_5'),
      lockEnd: null,
    });
    expect(shown(ctx)).toMatchObject({
      homePlanet: 'p1_1_5',
      mainPlanet: 'p1_1_5',
      mainLock: null,
    });
  });

  it('switches to an own colony and starts the lock, the first switch too (D5)', () => {
    const ctx = world();
    expect(choose(ctx, 'p2_3_7')).toBe('Kolonie ist jetzt dein Hauptplanet.');
    expect(anna(ctx)).toMatchObject({
      mainPlanet: 'p2_3_7',
      mainSwitched: START + 1,
    });
    expect(shown(ctx)).toMatchObject({
      homePlanet: 'p1_1_5',
      mainPlanet: 'p2_3_7',
      mainLock: START + 1 + 7 * DAY_MS,
    });
    // Bert's choice is his own.
    expect(mainPlanet(ctx, ctx.players.get('u_Bert')!)?.id).toBe('p1_2_5');
  });

  it('refuses another switch while locked with the time it is possible again, back to the first planet too (D4)', () => {
    const ctx = world();
    choose(ctx, 'p2_3_7');
    const end = START + 1 + 7 * DAY_MS;
    ctx.clock.t = end - 1;
    expect(() => choose(ctx, 'p1_1_5')).toThrow(
      'Der Hauptplanet ist gesperrt. Wieder änderbar ab 23.11.2026, 13:00.',
    );
    expect(anna(ctx)).toMatchObject({
      mainPlanet: 'p2_3_7',
      mainSwitched: START + 1,
    });
    ctx.clock.t = end;
    expect(choose(ctx, 'p1_1_5')).toBe('Heim ist jetzt dein Hauptplanet.');
    // The switch back starts the lock again.
    expect(anna(ctx)).toMatchObject({
      mainPlanet: 'p1_1_5',
      mainSwitched: end,
    });
    expect(shown(ctx).mainLock).toBe(end + 7 * DAY_MS);
    expect(() => choose(ctx, 'p2_3_7')).toThrow(
      'Der Hauptplanet ist gesperrt.',
    );
  });

  it('refuses a moon, a foreign or unknown planet and the current main planet, without a lock', () => {
    const ctx = world();
    expect(() => choose(ctx, 'm1_1_5')).toThrow(MAIN_ERROR.moon);
    expect(() => choose(ctx, 'p1_2_5')).toThrow(MAIN_ERROR.unknown);
    expect(() => choose(ctx, 'p9_9_9')).toThrow(MAIN_ERROR.unknown);
    expect(() => choose(ctx, 5)).toThrow(MAIN_ERROR.unknown);
    expect(() => choose(ctx, undefined)).toThrow(MAIN_ERROR.unknown);
    expect(() => choose(ctx, 'p1_1_5')).toThrow(MAIN_ERROR.same);
    expect(anna(ctx)).toMatchObject({ mainPlanet: null, mainSwitched: null });
    expect(MAIN_ERROR).toEqual({
      unknown: 'Das ist keiner deiner Planeten.',
      moon: 'Ein Mond kann nicht Hauptplanet sein.',
      same: 'Das ist bereits dein Hauptplanet.',
    });
  });

  it('names the end of the lock in the time of Berlin', () => {
    expect(lockEndText(Date.UTC(2026, 0, 2, 23, 5))).toBe('03.01.2026, 00:05');
    expect(lockEndText(Date.UTC(2026, 6, 2, 21, 5))).toBe('02.07.2026, 23:05');
    expect(lockedText(Date.UTC(2026, 6, 2, 21, 5))).toBe(
      'Der Hauptplanet ist gesperrt. Wieder änderbar ab 02.07.2026, 23:05.',
    );
  });

  it('shows a lock only while it holds', () => {
    const planet = { id: 'p1_1_5' } as Planet;
    expect(mainPlanetView({ planet, lockEnd: 10 }, 9)).toEqual({
      mainPlanet: 'p1_1_5',
      mainLock: 10,
    });
    expect(mainPlanetView({ planet, lockEnd: 10 }, 10)).toEqual({
      mainPlanet: 'p1_1_5',
      mainLock: null,
    });
    expect(mainPlanetView({ planet: null, lockEnd: null }, 9)).toEqual({
      mainPlanet: null,
      mainLock: null,
    });
  });
});

describe('the lock length per round (D3)', () => {
  it('is 7 days in an existing universe', () => {
    expect(roundRules(world()).mainLock).toBe(7);
  });

  it('is set by the admin for the new round and kept without a choice', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    runAction(ctx, 'u_Anna', { type: 'reset', mainLock: 3 }, event);
    expect(roundRules(ctx).mainLock).toBe(3);
    expect(ctx.admin.setting('roundMainLock')).toBe(3);
    expect(event.detail).toMatchObject({
      before: { mainLock: 7 },
      after: { mainLock: 3 },
    });
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(roundRules(ctx).mainLock).toBe(3);
    addPlanet(ctx, 'u_Anna', { g: 3, s: 3, p: 3, created: ctx.now() + 1 });
    choose(ctx, 'p3_3_3');
    expect(shown(ctx).mainLock).toBe(ctx.now() + 3 * DAY_MS);
    expect(shown(ctx).round.mainLock).toBe(3);
  });

  it('takes whole days from 1 to 30 only', () => {
    const ctx = world();
    for (const mainLock of [0, 31, 2.5, '7', null]) {
      expect(() =>
        runAction(ctx, 'u_Anna', { type: 'reset', mainLock }),
      ).toThrow(
        'Bitte für die Sperre des Hauptplaneten 1 bis 30 ganze Tage angeben.',
      );
    }
    expect(roundRules(ctx)).toMatchObject({ number: 1, mainLock: 7 });
    runAction(ctx, 'u_Anna', { type: 'reset', mainLock: 30 });
    expect(roundRules(ctx)).toMatchObject({ number: 2, mainLock: 30 });
    runAction(ctx, 'u_Anna', { type: 'reset', mainLock: 1 });
    expect(roundRules(ctx).mainLock).toBe(1);
  });

  it('a new round forgets the choice and its lock', () => {
    const ctx = world();
    choose(ctx, 'p2_3_7');
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(anna(ctx)).toMatchObject({ mainPlanet: null, mainSwitched: null });
    const first = ctx.planets.home('u_Anna')!;
    expect(shown(ctx)).toMatchObject({
      mainPlanet: first.id,
      mainLock: null,
    });
  });
});

describe('a main planet that is no longer the player’s (D6)', () => {
  it('falls back to the oldest planet left, without a lock', () => {
    const ctx = world();
    choose(ctx, 'p2_3_7');
    ctx.planets.save({ ...ctx.planets.get('p2_3_7')!, owner: 'u_Bert' });
    expect(mainPlanetOf(ctx, anna(ctx))).toEqual({
      planet: ctx.planets.get('p1_1_5'),
      lockEnd: null,
    });
    expect(shown(ctx)).toMatchObject({ mainPlanet: 'p1_1_5', mainLock: null });
    // The fallback is no switch: the choice is free at once.
    addPlanet(ctx, 'u_Anna', { g: 3, s: 3, p: 3 });
    expect(choose(ctx, 'p3_3_3')).toBe(
      'Planet u_Anna ist jetzt dein Hauptplanet.',
    );
  });

  it('falls back to the oldest planet the player still has when the first one is gone', () => {
    const ctx = world();
    choose(ctx, 'p2_3_7');
    ctx.planets.save({ ...ctx.planets.get('p1_1_5')!, owner: 'u_Bert' });
    expect(mainPlanet(ctx, anna(ctx))?.id).toBe('p2_3_7');
    ctx.planets.save({ ...ctx.planets.get('p2_3_7')!, owner: 'u_Bert' });
    expect(mainPlanetOf(ctx, anna(ctx))).toEqual({
      planet: null,
      lockEnd: null,
    });
    expect(shown(ctx)).toMatchObject({
      planet: null,
      mainPlanet: null,
      mainLock: null,
    });
  });
});

describe('what the main planet decides (D1)', () => {
  /** Anna with Kolonie as her main planet. */
  function switched(): TestCtx {
    const ctx = world();
    choose(ctx, 'p2_3_7');
    return ctx;
  }

  it('is the planet shown when none is selected; a selected own planet still wins', () => {
    const ctx = switched();
    expect(shown(ctx).planet?.id).toBe('p2_3_7');
    expect(shown(ctx, 'p1_1_5').planet?.id).toBe('p1_1_5');
    expect(shown(ctx, 'p1_2_5').planet?.id).toBe('p2_3_7');
  });

  it('is the planet of an action without a selection', () => {
    const ctx = switched();
    runAction(ctx, 'u_Anna', { type: 'rename', name: 'Front' });
    expect(ctx.planets.get('p2_3_7')!.name).toBe('Front');
    expect(ctx.planets.get('p1_1_5')!.name).toBe('Heim');
  });

  it('is where research without a selection starts, and where research from before #49 is refunded', () => {
    const ctx = switched();
    ctx.planets.save({ ...ctx.planets.get('p2_3_7')!, b: { lab: 1 } });
    runAction(ctx, 'u_Anna', { type: 'research', key: 'energy' });
    expect(anna(ctx).rq).toMatchObject({ key: 'energy', planet: 'p2_3_7' });
    runAction(ctx, 'u_Anna', { type: 'cancelResearch' });
    // Research started before #49 has no planet.
    const u = anna(ctx);
    const cost: [number, number, number] = [0, 800, 400];
    ctx.players.save({
      ...u,
      rq: {
        key: 'energy',
        lvl: 1,
        start: ctx.now(),
        end: ctx.now() + 9e6,
        cost,
      },
    });
    const before = ctx.planets.get('p2_3_7')!.res;
    const home = ctx.planets.get('p1_1_5')!.res;
    runAction(ctx, 'u_Anna', { type: 'cancelResearch' });
    expect(ctx.planets.get('p2_3_7')!.res.c).toBeCloseTo(before.c + 800, 0);
    expect(ctx.planets.get('p1_1_5')!.res.c).toBeCloseTo(home.c, 0);
  });

  it('leaves the daily reward with the first planet', () => {
    const ctx = switched();
    const home = ctx.planets.get('p1_1_5')!.res.m;
    const main = ctx.planets.get('p2_3_7')!.res.m;
    runAction(ctx, 'u_Anna', { type: 'claimDailyReward' });
    expect(ctx.planets.get('p1_1_5')!.res.m).toBeGreaterThan(home);
    expect(ctx.planets.get('p2_3_7')!.res.m).toBeCloseTo(main, 0);
  });

  it('leaves the Endzeit gift with the first planet', () => {
    const ctx = switched();
    runAction(ctx, 'u_Anna', { type: 'endzeit', minutes: 1 });
    const gift = ctx.fleets.all().find((f) => f.owner === 'u_Anna')!;
    expect(gift).toMatchObject({ from: 'p1_1_5', to: 'p1_1_5' });
    ctx.clock.t = gift.arr;
    tick(ctx);
    expect(ctx.planets.get('p1_1_5')!.ships).not.toEqual({});
    expect(ctx.planets.get('p2_3_7')!.ships).toEqual({});
  });
});
