// Raketenangriff (#54, okf/features/missiles.md): the launch from the
// Raketenkrypta, the flight without a fleet slot and without a recall, and
// the impact: the Abfangraketen first (at a moon those of its planet), then
// the main target and the catalog order; nothing is rebuilt, no
// Trümmerfeld, a report for both sides.
import { describe, expect, it } from 'vitest';
import { runAction } from '../../../server/game/dispatch.ts';
import { tick } from '../../../server/game/arrival.ts';
import { pointsMap } from '../../../server/game/points.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import type { Data } from '../../../server/game/actions.ts';

const HOME = { g: 1, s: 1, p: 5 };
const BETA = { g: 1, s: 3, p: 6 };

/**
 * Anna with 10 Orbitalraketen on her home planet and the impulse drive 1
 * (range 4 systems); Bert two systems away with defense, two Abfangraketen
 * and research that keeps the noob protection away.
 */
function setup(over: { def?: Record<string, number>; moon?: boolean } = {}) {
  const ctx = testCtx(1_000_000, 54);
  const anna = addUser(ctx, 'Anna', { research: { impulse: 1 } });
  addUser(ctx, 'Bert', { research: { energy: 12 } });
  addPlanet(ctx, anna.id, {
    ...HOME,
    b: { yard: 1, silo: 4 },
    def: { ipm: 10 },
  });
  addPlanet(ctx, 'u_Bert', {
    ...BETA,
    name: 'Beta',
    def: over.def ?? { rl: 100, gauss: 10, abm: 2 },
  });
  if (over.moon)
    addPlanet(ctx, 'u_Bert', {
      ...BETA,
      id: 'm1_3_6',
      kind: 'moon',
      name: 'Trabant',
      def: { rl: 50 },
    });
  return { ctx, anna };
}

const launch = (
  ctx: ReturnType<typeof testCtx>,
  d: Data,
): ReturnType<typeof runAction> =>
  runAction(ctx, 'u_Anna', {
    type: 'missile',
    planet: 'p1_1_5',
    to: { ...BETA, kind: 'planet' },
    n: 3,
    ...d,
  });

const reports = (ctx: ReturnType<typeof testCtx>, uid: string) =>
  ctx.reports.ofPlayer(uid).map((r) => [r.title, r.text]);

describe('missile: the launch', () => {
  it('takes the missiles off the planet and flies without a fleet slot', () => {
    const { ctx } = setup();
    expect(launch(ctx, { aim: 'gauss' })).toBe(
      '3 Orbitalraketen unterwegs nach [1:3:6].',
    );
    expect(ctx.planets.get('p1_1_5')!.def).toEqual({ ipm: 7 });
    const [f] = ctx.fleets.all();
    expect(f).toMatchObject({
      owner: 'u_Anna',
      from: 'p1_1_5',
      to: 'p1_3_6',
      mission: 'missile',
      ships: { ipm: 3 },
      cargo: { m: 0, c: 0, d: 0 },
      fuel: 0,
      state: 'out',
      aim: 'gauss',
      dep: 1_000_000,
      // (30 + 60 × 2) / universe speed 5 = 30 seconds; no way back.
      arr: 1_030_000,
      ret: 1_030_000,
    });
    expect(ctx.fleets.count('u_Anna', ['missile'])).toBe(0);
    // Points: the missiles in flight still count.
    expect(pointsMap(ctx).u_Anna).toBeGreaterThan(0);
    const before = pointsMap(ctx).u_Anna;
    launch(ctx, { n: 7 });
    expect(pointsMap(ctx).u_Anna).toBe(before);
    expect(ctx.fleets.all()[1]).not.toHaveProperty('aim');
  });

  it('refuses with the message of the first reason and changes nothing', () => {
    const cases: [Data, string][] = [
      [{ n: 0 }, 'Bitte eine Anzahl eingeben.'],
      [{ n: 11 }, 'Nicht genug Orbitalraketen.'],
      [{ aim: 'abm' }, 'Unbekanntes Hauptziel.'],
      [
        { to: { g: 1, s: 3, p: 9 } },
        'An dieser Position gibt es keinen Planeten.',
      ],
      [
        { to: { ...BETA, kind: 'moon' } },
        'An dieser Position gibt es keinen Mond.',
      ],
      [
        { to: { g: 1, s: 1, p: 5 } },
        'Eigene Planeten kann man nicht angreifen.',
      ],
      [
        { to: { g: 1, s: 6, p: 1 } },
        'Das Ziel liegt außerhalb der Reichweite der Orbitalraketen.',
      ],
    ];
    for (const [d, msg] of cases) {
      const { ctx } = setup();
      addPlanet(ctx, 'u_Bert', { g: 1, s: 6, p: 1 });
      const before = ctx.planets.all();
      expect(() => launch(ctx, d), msg).toThrow(msg);
      expect(ctx.planets.all()).toEqual(before);
      expect(ctx.fleets.all()).toEqual([]);
    }
  });

  it('refuses a player under noob protection', () => {
    const { ctx } = setup();
    addUser(ctx, 'Cora');
    addPlanet(ctx, 'u_Cora', { g: 1, s: 2, p: 2 });
    expect(() => launch(ctx, { to: { g: 1, s: 2, p: 2 } })).toThrow(
      'Dieser Spieler steht unter Noobschutz.',
    );
  });

  it('cannot be recalled and is never sent as a fleet', () => {
    const { ctx } = setup();
    launch(ctx, {});
    const [f] = ctx.fleets.all();
    expect(() =>
      runAction(ctx, 'u_Anna', { type: 'recall', id: f!.id }),
    ).toThrow('Rückruf nicht mehr möglich.');
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'send',
        planet: 'p1_1_5',
        mission: 'missile',
        ships: { ipm: 1 },
        to: BETA,
        pct: 10,
      }),
    ).toThrow('Unbekannter Auftrag.');
  });
});

describe('missile: the impact', () => {
  it('is stopped by the Abfangraketen first, then hits the main target and the catalog order', () => {
    const { ctx } = setup();
    launch(ctx, { aim: 'gauss' });
    ctx.clock.t = 1_030_000;
    tick(ctx);
    expect(ctx.fleets.all()).toEqual([]);
    // 2 of 3 stopped; one hits: 3 Massebeschleuniger, the rest 7
    // Raketenbatterien. Nothing is rebuilt.
    expect(ctx.planets.get('p1_3_6')!.def).toEqual({ rl: 93, gauss: 7 });
    const text =
      '1 Orbitalraketen trafen [1:3:6]; 2 wurden abgefangen. Zerstört: 3 Massebeschleuniger, 7 Raketenbatterie.';
    expect(reports(ctx, 'u_Anna')).toEqual([['Raketenangriff [1:3:6]', text]]);
    expect(reports(ctx, 'u_Bert')).toEqual([
      ['Feindkontakt! Beta [1:3:6] wird von Anna angegriffen', text],
    ]);
    // No Trümmerfeld; an entry in the audit log of the admin.
    expect(ctx.debris.get('d1_3_6')).toBeNull();
    const audit = ctx.db
      .prepare(
        "SELECT actor, target, detail FROM audit_events WHERE action = 'missile' AND category = 'system'",
      )
      .all() as { actor: string; target: string; detail: string }[];
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: 'u_Anna', target: 'u_Bert' });
    expect(JSON.parse(audit[0]!.detail)).toMatchObject({
      planet: 'p1_3_6',
      missiles: 3,
      intercepted: 2,
    });
  });

  it('reports when everything was stopped, and uses the research at the arrival', () => {
    const { ctx } = setup({ def: { rl: 1000, abm: 5 } });
    launch(ctx, { n: 2 });
    ctx.clock.t = 1_030_000;
    tick(ctx);
    expect(ctx.planets.get('p1_3_6')!.def).toEqual({ rl: 1000, abm: 3 });
    expect(reports(ctx, 'u_Anna')[0]![1]).toBe(
      '0 Orbitalraketen trafen [1:3:6]; 2 wurden abgefangen. Keine Verteidigung zerstört.',
    );
    const next = setup({ def: { rl: 1000 } });
    next.ctx.players.save({
      ...next.anna,
      research: { impulse: 1, weapons: 2 },
    });
    launch(next.ctx, { n: 1 });
    next.ctx.clock.t = 1_030_000;
    tick(next.ctx);
    expect(next.ctx.planets.get('p1_3_6')!.def).toEqual({ rl: 928 });
  });

  it('destroys the stored missiles once no defense is left (owner, 2026-11-17)', () => {
    const { ctx } = setup({ def: { rl: 10, abm: 1, ipm: 3 } });
    launch(ctx, {});
    ctx.clock.t = 1_030_000;
    tick(ctx);
    // One stopped by the only Abfangrakete; two hit: 10 Raketenbatterien,
    // then the 3 Orbitalraketen in the silo.
    expect(ctx.planets.get('p1_3_6')!.def).toEqual({});
    expect(reports(ctx, 'u_Anna')[0]![1]).toBe(
      '2 Orbitalraketen trafen [1:3:6]; 1 wurden abgefangen. Zerstört: 10 Raketenbatterie, 3 Orbitalrakete.',
    );
  });

  it('at a moon is stopped by the Abfangraketen of its planet', () => {
    const { ctx } = setup({ moon: true });
    launch(ctx, { to: { ...BETA, kind: 'moon' } });
    ctx.clock.t = 1_030_000;
    tick(ctx);
    expect(ctx.planets.get('m1_3_6')!.def).toEqual({});
    expect(ctx.planets.get('p1_3_6')!.def).toEqual({ rl: 100, gauss: 10 });
    expect(reports(ctx, 'u_Bert')[0]![0]).toBe(
      'Feindkontakt! Trabant (Mond) [1:3:6] wird von Anna angegriffen',
    );
  });

  it('is lost when its target is gone', () => {
    const { ctx } = setup();
    launch(ctx, {});
    ctx.db.prepare("DELETE FROM planets WHERE id = 'p1_3_6'").run();
    ctx.clock.t = 1_030_000;
    tick(ctx);
    expect(ctx.fleets.all()).toEqual([]);
    expect(ctx.planets.get('p1_1_5')!.def).toEqual({ ipm: 7 });
    expect(reports(ctx, 'u_Anna')).toEqual([
      [
        'Raketenangriff [1:3:6]',
        'An [1:3:6] wurde kein passendes Ziel gefunden. Deine Orbitalraketen sind verloren.',
      ],
    ]);
  });
});
