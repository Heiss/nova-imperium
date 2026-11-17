// Vermessung (#190): only Spähschädel with Auspex-Kartographie, to a free
// position; the report shows what the score reaches, the probes may be lost,
// and the values of the position stay for the colony founded there.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fieldsOf } from '../../../core/fields.ts';
import type { Coords, Fleet, Levels } from '../../../core/types.ts';
import { arrive } from '../../../server/game/arrival.ts';
import { send } from '../../../server/game/fleet-actions.ts';
import { purgeSurveys } from '../../../server/game/surveys.ts';
import {
  type TestCtx,
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

const HOME = { g: 1, s: 1, p: 5 };
const FREE = { g: 1, s: 42, p: 9 };
const DAY = 86400000;

const sendFleet = (ships: Levels, research: Levels = { carto: 1 }) => ({
  owner: 'a',
  from: 'p1',
  ships,
  research,
});

/** Anna with Auspex-Kartographie at `level`, and a fleet of `probes` at a free position. */
function setup(probes: number, level: number, seed = 7, to: Coords = FREE) {
  const ctx = testCtx(1_000_000, seed);
  addUser(ctx, 'Anna', { research: { carto: level } });
  addPlanet(ctx, 'u_Anna', { ...HOME, ships: { probe: 50, colony: 1 } });
  const f = flight(ctx, 'f1', 'survey', { probe: probes }, to);
  return { ctx, f };
}

function flight(
  ctx: TestCtx,
  id: string,
  mission: Fleet['mission'],
  ships: Levels,
  to: Coords,
): Fleet {
  const f: Fleet = {
    id,
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: HOME,
    to: `p${to.g}_${to.s}_${to.p}`,
    toC: to,
    mission,
    ships,
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  return f;
}

/** A random generator that never loses the probes: the chance draws 0. */
const keep = (ctx: TestCtx): void => {
  const rest = ctx.rng;
  let first = true;
  ctx.rng = () => (first ? ((first = false), 0) : rest());
};

describe('survey', () => {
  it('flies to a free position with Spähschädel only, without cargo, and comes home silently', () => {
    expect(rules).toMatchObject({
      order: 70,
      target: 'free',
      cargo: false,
      returns: true,
      visible: false,
      silent: true,
      alertsGuild: false,
    });
  });

  it('needs level 1 of Auspex-Kartographie, then only Spähschädel', () => {
    expect(canSend(sendFleet({ probe: 3 }))).toBeUndefined();
    expect(canSend(sendFleet({ probe: 3 }, { carto: 4 }))).toBeUndefined();
    expect(canSend(sendFleet({ probe: 3, sc: 1 }))).toBe('surveyProbesOnly');
    expect(canSend(sendFleet({ lc: 1 }))).toBe('surveyProbesOnly');
    expect(canSend(sendFleet({ probe: 3 }, {}))).toBe('surveyLocked');
    expect(canSend(sendFleet({ probe: 3 }, { carto: 0, spy: 9 }))).toBe(
      'surveyLocked',
    );
    expect(canSend({ owner: 'a', from: 'p1', ships: { probe: 1 } })).toBe(
      'surveyLocked',
    );
  });

  it('refuses a send with the German messages', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id, { ...HOME, ships: { probe: 5, sc: 1 } });
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 7 });
    const go = (ships: Levels, to: Coords = FREE) =>
      send(ctx, ctx.players.get(anna.id)!, {
        planet: 'p1_1_5',
        ships,
        to,
        mission: 'survey',
        pct: 10,
      });
    expect(() => go({ probe: 1 })).toThrow(
      'Vermessung erst mit Auspex-Kartographie.',
    );
    ctx.players.save({ ...ctx.players.get(anna.id)!, research: { carto: 1 } });
    expect(() => go({ probe: 1, sc: 1 })).toThrow(
      'Vermessung nur mit Spähschädeln.',
    );
    expect(() => go({ probe: 1 }, { g: 1, s: 1, p: 7 })).toThrow(
      'Diese Position ist bereits besetzt.',
    );
    go({ probe: 2 });
    expect(ctx.fleets.all()).toMatchObject([
      { mission: 'survey', ships: { probe: 2 }, toC: FREE },
    ]);
  });

  it('gives a rough report with one probe at level 1 and flies back', () => {
    const { ctx, f } = setup(1, 1);
    keep(ctx);
    subscribePush(ctx, 'u_Anna');
    onArrive(ctx, f);
    const [report] = ctx.reports.ofPlayer('u_Anna');
    const stored = ctx.surveys.get(FREE)!;
    expect(report).toEqual({
      id: report!.id,
      time: f.arr,
      type: 'survey',
      title: 'Vermessungsbericht [1:42:9]',
      coords: FREE,
      survey: stored.id,
      tier: 'rough',
      planetType: 'dschungel',
      range: { min: 150, max: 246 },
      average: 198,
      around: 50,
      orbit: 'middle',
      size: 'medium',
    });
    expect(stored).toMatchObject({ ...FREE, created: f.arr });
    expect(ctx.fleets.get('f1')?.state).toBe('back');
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
    ]);
  });

  it('shows more with more probes and research: near, exact and full', () => {
    for (const [probes, level, tier] of [
      [2, 1, 'near'],
      [5, 1, 'exact'],
      [8, 1, 'full'],
      [1, 5, 'full'],
    ] as const) {
      const { ctx, f } = setup(probes, level);
      keep(ctx);
      onArrive(ctx, f);
      expect(
        ctx.reports.ofPlayer('u_Anna')[0],
        `${probes}/${level}`,
      ).toMatchObject({
        tier,
      });
    }
  });

  it('shifts the windows of score 4 once, when the report is made, and stores them (owner, 2026-11-17)', () => {
    const { ctx, f } = setup(2, 1);
    ctx.surveys.add({
      id: 'v1',
      ...FREE,
      temp: 72,
      diameter: 14600,
      created: f.arr,
    });
    // The loss chance 0, its roll, then the shift of the fields and of the temperature.
    const draws = [0, 0.5, 0, 0.9999];
    ctx.rng = () => draws.shift()!;
    onArrive(ctx, f);
    expect(draws).toEqual([]);
    const near = {
      tier: 'near',
      fields: { min: 213, max: 298 },
      temp: { min: 52, max: 72 },
    };
    expect(ctx.reports.ofPlayer('u_Anna')).toMatchObject([near]);
    // The report keeps its windows, and the shift itself is not stored.
    ctx.rng = () => 0.5;
    const [again] = ctx.reports.ofPlayer('u_Anna');
    expect(again).toMatchObject(near);
    expect(JSON.stringify(again)).not.toMatch(/shift|0\.9999/);
  });

  it('names the orbit with the positions of the universe (D5, owner, 2026-11-17)', () => {
    const orbit = (positions: number) => {
      const to = { g: 1, s: 42, p: 16 };
      const { ctx, f } = setup(1, 1, 7, to);
      ctx.admin.saveUniverse({ ...ctx.admin.universe(), positions });
      keep(ctx);
      onArrive(ctx, f);
      return ctx.reports.ofPlayer('u_Anna')[0];
    };
    // The bands of 20 positions are scaled: 16 is still the middle orbit [V].
    expect(orbit(20)).toMatchObject({ orbit: 'middle', size: 'small' });
    expect(orbit(16)).toMatchObject({ orbit: 'outer', size: 'small' });
  });

  it('takes the research finished at the arrival', () => {
    const { ctx, f } = setup(4, 1);
    ctx.players.save({
      ...ctx.players.get('u_Anna')!,
      rq: {
        key: 'carto',
        lvl: 3,
        start: 0,
        end: f.arr,
        cost: [0, 0, 0],
        planet: 'p1_1_5',
      },
    });
    keep(ctx);
    onArrive(ctx, f);
    // 4 probes + 2 · 3 = 10.
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({ tier: 'full' });
  });

  it('loses the probes without a report and without values (D7)', () => {
    const { ctx, f } = setup(8, 1);
    // The chance 0.99 · max, then a roll of 0.
    const draws = [0.99, 0];
    ctx.rng = () => draws.shift() ?? 0.5;
    onArrive(ctx, f);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.surveys.get(FREE)).toBeNull();
  });

  it('loses more probes the farther they fly', () => {
    const lost = (to: Coords): number => {
      const { ctx } = setup(1, 5, 5, to);
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const f = flight(ctx, `g${i}`, 'survey', { probe: 1 }, to);
        onArrive(ctx, f);
        if (!ctx.fleets.get(f.id)) n++;
      }
      return n;
    };
    // Level 5, one probe: 3 % in the system, 23 % to the next galaxy.
    const near = lost({ g: 1, s: 1, p: 9 });
    const far = lost({ g: 2, s: 1, p: 9 });
    expect(near).toBeLessThan(20);
    expect(far).toBeGreaterThan(30);
    expect(far).toBeLessThan(80);
  });

  it('keeps the values of the first survey for later surveys', () => {
    const { ctx, f } = setup(8, 1);
    keep(ctx);
    onArrive(ctx, f);
    const first = ctx.surveys.get(FREE)!;
    ctx.clock.t += DAY;
    const again = flight(ctx, 'f2', 'survey', { probe: 8 }, FREE);
    keep(ctx);
    onArrive(ctx, again);
    expect(ctx.surveys.get(FREE)).toEqual(first);
    const [second, one] = ctx.reports.ofPlayer('u_Anna');
    expect(second).toMatchObject({ survey: first.id });
    expect({ ...second, id: '', time: 0 }).toEqual({ ...one, id: '', time: 0 });
  });

  it('founds the colony with the surveyed values and forgets them', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 0, max: 10000 }),
        (p, seed) => {
          const to = { g: 1, s: 42, p };
          const { ctx, f } = setup(8, 1, seed, to);
          keep(ctx);
          onArrive(ctx, f);
          const full = ctx.reports.ofPlayer('u_Anna')[0] as unknown as {
            full: { temp: number; diameter: number; fields: number };
          };
          arrive(ctx, flight(ctx, 'f2', 'colonize', { colony: 1 }, to));
          const colony = ctx.planets.get(`p1_42_${p}`)!;
          expect(colony.temp).toBe(full.full.temp);
          expect(colony.diameter).toBe(full.full.diameter);
          expect(fieldsOf(colony.diameter)).toBe(full.full.fields);
          expect(ctx.surveys.get(to)).toBeNull();
        },
      ),
      { numRuns: 40 },
    );
  });

  it('colonizes an unsurveyed position as before', () => {
    const a = testCtx(1_000_000, 3);
    const b = testCtx(1_000_000, 3);
    for (const ctx of [a, b]) {
      addUser(ctx, 'Anna');
      addPlanet(ctx, 'u_Anna', HOME);
    }
    b.surveys.add({
      id: 'v1',
      g: 1,
      s: 7,
      p: 9,
      temp: 1,
      diameter: 9000,
      created: 0,
    });
    arrive(a, flight(a, 'f1', 'colonize', { colony: 1 }, FREE));
    arrive(b, flight(b, 'f1', 'colonize', { colony: 1 }, FREE));
    expect(b.planets.get('p1_42_9')).toEqual(a.planets.get('p1_42_9'));
    expect(b.surveys.get({ g: 1, s: 7, p: 9 })).not.toBeNull();
  });

  it('turns back when the position was colonized meanwhile', () => {
    const { ctx, f } = setup(1, 1);
    addPlanet(ctx, 'u_Anna', { ...FREE, name: 'Neu' });
    arrive(ctx, f);
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.title)).toEqual([
      'Flotte kehrt um',
    ]);
    expect(ctx.surveys.get(FREE)).toBeNull();
  });
});

describe('the cleanup of surveys after 30 days (D1)', () => {
  it('deletes the values and the reports of a survey nobody colonized', () => {
    const { ctx, f } = setup(1, 1, 1);
    keep(ctx);
    onArrive(ctx, f);
    ctx.reports.add(
      'u_Anna',
      { id: 'other', time: 1, type: 'info', title: 'Anderes' },
      50,
    );
    ctx.clock.t = f.arr + 30 * DAY;
    purgeSurveys(ctx);
    expect(ctx.surveys.get(FREE)).not.toBeNull();
    ctx.clock.t += 1;
    purgeSurveys(ctx);
    expect(ctx.surveys.get(FREE)).toBeNull();
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.id)).toEqual(['other']);
    // A later survey rolls new values.
    const again = flight(ctx, 'f2', 'survey', { probe: 1 }, FREE);
    keep(ctx);
    onArrive(ctx, again);
    expect(ctx.surveys.get(FREE)).toMatchObject({ created: again.arr });
  });

  it('keeps the reports once the position is colonized', () => {
    const { ctx, f } = setup(1, 1, 1);
    keep(ctx);
    onArrive(ctx, f);
    arrive(ctx, flight(ctx, 'f2', 'colonize', { colony: 1 }, FREE));
    ctx.clock.t = f.arr + 31 * DAY;
    purgeSurveys(ctx);
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.type)).toEqual([
      'info',
      'survey',
    ]);
  });

  it('gives the same report for the same seed', () => {
    const a = setup(3, 1, 11);
    const b = setup(3, 1, 11);
    onArrive(a.ctx, a.f);
    onArrive(b.ctx, b.f);
    expect(a.ctx.reports.ofPlayer('u_Anna')).toEqual(
      b.ctx.reports.ofPlayer('u_Anna'),
    );
  });
});
