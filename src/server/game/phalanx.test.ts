// The scan of the Auspex-Phalanx on the server (#53, owner, 2026-11-13 and
// 2026-11-15): from the active moon with a phalanx to a foreign planet in
// range of the own galaxy, 5,000 Promethium charged in the transaction, every
// refusal free, the flights by arrival without cargo, owner or mission, and
// nothing told to the scanned player.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, queuedPushes, testCtx } from '../test-helpers.ts';
import { answerOf } from './actions.ts';
import { ACTIONS, runAction } from './dispatch.ts';
import { addMoon } from './moons.ts';
import { SCAN_ERROR } from './phalanx.ts';

const MOON = 'm1_5_4';

/**
 * Anna's moon at [1:5:4] with a phalanx of level 2 (3 systems); Bert at
 * [1:7:7] in range, Cleo at [1:9:9] out of range, Dora at [2:5:7] in the
 * other galaxy.
 */
function world(phalanx = 2, promethium = 12000) {
  const ctx = testCtx();
  const anna = addUser(ctx, 'Anna');
  const home = addPlanet(ctx, anna.id, { g: 1, s: 5, p: 4 });
  const moon = addMoon(ctx, home, 10, ctx.now());
  ctx.planets.save({
    ...moon,
    b: { moonbase: 1, phalanx },
    res: { m: 100, c: 200, d: promethium },
  });
  for (const [name, g, s, p] of [
    ['Bert', 1, 7, 7],
    ['Cleo', 1, 9, 9],
    ['Dora', 2, 5, 7],
  ] as const) {
    addUser(ctx, name);
    addPlanet(ctx, `u_${name}`, { g, s, p });
  }
  return { ctx, anna };
}

let n = 0;
const fleet = (over: Partial<Fleet>): Fleet => ({
  id: `f${++n}`,
  owner: 'u_Cleo',
  from: 'p1_9_9',
  fromC: { g: 1, s: 9, p: 9 },
  to: 'p1_7_7',
  toC: { g: 1, s: 7, p: 7 },
  mission: 'attack',
  ships: { lc: 10 },
  cargo: { m: 500, c: 400, d: 300 },
  dep: 1_000_000,
  arr: 2_000_000,
  ret: 3_000_000,
  state: 'out',
  recalled: false,
  fuel: 120,
  ...over,
});

const scan = (
  ctx: ReturnType<typeof world>['ctx'],
  target: unknown,
  planet: unknown = MOON,
) => answerOf(runAction(ctx, 'u_Anna', { type: 'scan', planet, target }));

const promethium = (ctx: ReturnType<typeof world>['ctx']): number =>
  ctx.planets.get(MOON)!.res.d;

describe('the scan of the Auspex-Phalanx', () => {
  it('is an action of the command map', () => {
    expect(Object.hasOwn(ACTIONS, 'scan')).toBe(true);
  });

  it('names every refusal in German, each with its own message', () => {
    expect(SCAN_ERROR).toEqual({
      notMoon: 'Ein Phalanx-Scan ist nur von einem Mond aus möglich.',
      noPhalanx: 'Auf diesem Mond steht keine Auspex-Phalanx.',
      outOfRange: 'Das Ziel liegt außerhalb der Reichweite der Auspex-Phalanx.',
      free: 'An dieser Position gibt es keinen Planeten.',
      moon: 'Monde lassen sich nicht erfassen.',
      notPlanet: 'Nur Planeten lassen sich erfassen.',
      own: 'Eigene Planeten lassen sich nicht erfassen.',
      cost: 'Nicht genug Promethium für den Phalanx-Scan.',
    });
  });

  it('shows the flights to and from a foreign planet in range, by arrival, and charges 5,000 Promethium', () => {
    const { ctx } = world();
    ctx.fleets.save(fleet({ arr: 2_500_000 }));
    ctx.fleets.save(
      fleet({
        owner: 'u_Bert',
        from: 'p1_7_7',
        to: 'p1_9_9',
        mission: 'transport',
        state: 'back',
        ret: 1_500_000,
      }),
    );
    // A flight to the moon of the planet and one elsewhere are not shown.
    ctx.fleets.save(fleet({ to: 'm1_7_7' }));
    ctx.fleets.save(fleet({ to: 'p2_5_7' }));
    const answer = scan(ctx, 'p1_7_7');
    expect(answer).toEqual({
      msg: null,
      data: {
        scan: {
          by: MOON,
          target: 'p1_7_7',
          flights: [
            {
              ships: { lc: 10 },
              from: 'p1_9_9',
              to: 'p1_7_7',
              arr: 1_500_000,
            },
            {
              ships: { lc: 10 },
              from: 'p1_9_9',
              to: 'p1_7_7',
              arr: 2_500_000,
            },
          ],
        },
      },
    });
    expect(promethium(ctx)).toBe(7000);
    expect(ctx.planets.get(MOON)!.res).toMatchObject({ m: 100, c: 200 });
  });

  it('charges 5,000 Promethium also for a planet without flights, which shows an empty result', () => {
    const { ctx } = world();
    expect(scan(ctx, 'p1_7_7').data).toEqual({
      scan: { by: MOON, target: 'p1_7_7', flights: [] },
    });
    expect(promethium(ctx)).toBe(7000);
    expect(scan(ctx, 'p1_7_7').data).toMatchObject({ scan: { flights: [] } });
    expect(promethium(ctx)).toBe(2000);
  });

  it('lands due fleets first, so a fleet that arrived shows its way back', () => {
    const { ctx } = world();
    ctx.fleets.save(
      fleet({
        owner: 'u_Bert',
        from: 'p1_7_7',
        to: 'p1_9_9',
        mission: 'transport',
        cargo: { m: 0, c: 0, d: 0 },
        arr: ctx.now() - 1,
        ret: ctx.now() + 5000,
      }),
    );
    expect(scan(ctx, 'p1_7_7').data).toMatchObject({
      scan: {
        flights: [{ from: 'p1_9_9', to: 'p1_7_7', arr: ctx.now() + 5000 }],
      },
    });
  });

  it('shows a recalled fleet from the target it turned away from', () => {
    const { ctx } = world();
    ctx.fleets.save(
      fleet({
        owner: 'u_Bert',
        from: 'p1_7_7',
        to: 'p1_9_9',
        dep: ctx.now() - 50_000,
        arr: ctx.now() + 100_000,
      }),
    );
    const id = ctx.fleets.all()[0]!.id;
    expect(runAction(ctx, 'u_Bert', { type: 'recall', id })).toBe(
      'Flotte zurückgerufen.',
    );
    const ret = ctx.fleets.get(id)!.ret;
    expect(scan(ctx, 'p1_7_7').data).toMatchObject({
      scan: { flights: [{ from: 'p1_9_9', to: 'p1_7_7', arr: ret }] },
    });
  });

  it('tells the scanned player nothing: no report, no push', () => {
    const { ctx } = world();
    ctx.fleets.save(fleet({}));
    const reports = ctx.reports.ofPlayer('u_Bert').length;
    scan(ctx, 'p1_7_7');
    expect(ctx.reports.ofPlayer('u_Bert')).toHaveLength(reports);
    expect(ctx.reports.ofPlayer('u_Anna')).toHaveLength(0);
    expect(queuedPushes(ctx)).toEqual([]);
  });

  it('names the moon, the target and the number of flights in the audit event', () => {
    const { ctx, anna } = world();
    ctx.fleets.save(fleet({}));
    const event = { category: 'game', action: 'scan' } as AuditEntry;
    ACTIONS.scan!(
      ctx,
      anna,
      { type: 'scan', planet: MOON, target: 'p1_7_7' },
      event,
    );
    expect(event.detail).toEqual({
      planet: MOON,
      target: 'p1_7_7',
      flights: 1,
    });
  });

  it.each([
    [
      'a free position in range',
      'p1_6_1',
      'An dieser Position gibt es keinen Planeten.',
    ],
    ['a moon', 'm1_5_4', 'Monde lassen sich nicht erfassen.'],
    ['a foreign moon in range', 'm1_7_7', 'Monde lassen sich nicht erfassen.'],
    ['a Trümmerfeld', 'd1_7_7', 'Nur Planeten lassen sich erfassen.'],
    ['an own planet', 'p1_5_4', 'Eigene Planeten lassen sich nicht erfassen.'],
    [
      'a planet out of range',
      'p1_9_9',
      'Das Ziel liegt außerhalb der Reichweite der Auspex-Phalanx.',
    ],
    [
      'a planet of another galaxy',
      'p2_5_7',
      'Das Ziel liegt außerhalb der Reichweite der Auspex-Phalanx.',
    ],
    ['an id that is no place', 'p1_07_7', 'Unbekanntes Ziel.'],
    ['no id', undefined, 'Unbekanntes Ziel.'],
    ['an id that is no string', ['p1_7_7', 'x'], 'Unbekanntes Ziel.'],
  ])('refuses %s without charge', (_, target, message) => {
    const { ctx } = world();
    expect(() => scan(ctx, target)).toThrow(message);
    expect(promethium(ctx)).toBe(12000);
  });

  it('refuses a scan from a planet, from a moon without phalanx and from a foreign moon', () => {
    const { ctx } = world(0);
    expect(() => scan(ctx, 'p1_7_7', 'p1_5_4')).toThrow(
      'Ein Phalanx-Scan ist nur von einem Mond aus möglich.',
    );
    expect(() => scan(ctx, 'p1_7_7')).toThrow(
      'Auf diesem Mond steht keine Auspex-Phalanx.',
    );
    expect(() => scan(ctx, 'p1_7_7', 'p1_7_7')).toThrow(
      'Du hast keinen Zugriff auf diesen Planeten.',
    );
    expect(promethium(ctx)).toBe(12000);
  });

  it('refuses a scan without 5,000 Promethium on the moon, and charges nothing', () => {
    const { ctx } = world(2, 4999);
    expect(() => scan(ctx, 'p1_7_7')).toThrow(
      'Nicht genug Promethium für den Phalanx-Scan.',
    );
    expect(promethium(ctx)).toBe(4999);
  });

  it('reaches level² − 1 systems in the own galaxy (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 30 }),
        (level, s) => {
          const { ctx } = world(level);
          addUser(ctx, 'Eve');
          addPlanet(ctx, 'u_Eve', { g: 1, s, p: 8 });
          const reached = Math.abs(s - 5) <= level * level - 1;
          if (reached) {
            expect(scan(ctx, `p1_${s}_8`).data).toMatchObject({
              scan: { flights: [] },
            });
            expect(promethium(ctx)).toBe(7000);
          } else {
            expect(() => scan(ctx, `p1_${s}_8`)).toThrow(
              'Das Ziel liegt außerhalb der Reichweite der Auspex-Phalanx.',
            );
            expect(promethium(ctx)).toBe(12000);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('the answer of an action', () => {
  it('is the message alone, or the message and the data', () => {
    expect(answerOf(null)).toEqual({ msg: null });
    expect(answerOf('Gespeichert.')).toEqual({ msg: 'Gespeichert.' });
    const data = { scan: 1 };
    expect(answerOf({ msg: null, data })).toEqual({ msg: null, data });
  });
});
