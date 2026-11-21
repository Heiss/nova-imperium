// Tearing down a building level (#202): the action `demolish`, its
// refusals, the refund factor and time of the round, the cancel, the points
// and the settings of the round in „Neue Runde“ and the universe settings.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNIVERSE,
  liveSpecs,
  UNIVERSE_SPECS,
} from '../../core/universe.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import type { AuditEntry } from '../audit.ts';
import * as A from './actions.ts';
import { DEMOLITION_ERROR, demolish } from './demolition.ts';
import { runAction } from './dispatch.ts';
import { addMoon } from './moons.ts';
import { pointsMap } from './points.ts';
import { roundRules } from './round.ts';

function setup(planet = {}, settings: Record<string, number> = {}) {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna');
  addPlanet(ctx, u.id, planet);
  ctx.admin.saveUniverse({ ...ctx.admin.universe(), ...settings });
  const p = () => ctx.planets.home(u.id)!;
  return { ctx, u, p };
}

const rich = { m: 10_000, c: 10_000, d: 10_000 };

describe('a demolition (#202)', () => {
  it('goes down one level in a share of the build time and gives back at its end (D1, D2, D3, D7)', () => {
    // Metal level 1 costs 60 / 15 / 0 and builds in 21,600 ms at speed 5.
    const { ctx, u, p } = setup({ b: { metal: 2, crystal: 1 }, res: rich });
    const start = ctx.now();
    const event: AuditEntry = { category: 'game', action: 'demolish' };
    expect(demolish(ctx, u, { key: 'crystal' }, event)).toBeNull();
    // Crystal level 1 costs 48 / 24: back 24 / 12 at +50 %, in 50 % of 20,736 ms.
    expect(p().bq).toEqual({
      key: 'crystal',
      lvl: 0,
      start,
      end: start + 10368,
      cost: [0, 0, 0],
      back: [24, 12, 0],
    });
    expect(p().res).toEqual(rich);
    expect(event.detail).toEqual({
      planet: p().id,
      key: 'crystal',
      level: 0,
      due: start + 10368,
    });
    ctx.clock.t = start + 10367;
    expect(A.mine(ctx, u).b.crystal).toBe(1);
    ctx.clock.t = start + 10368;
    const done = A.mine(ctx, u);
    expect(done.b.crystal).toBe(0);
    expect(done.bq).toBeNull();
  });

  it('gives back the full cost at +100 %, nothing at 0 % and costs it once more at −100 %', () => {
    for (const [refund, res, back] of [
      [100, rich, [60, 15, 0]],
      [0, rich, [0, 0, 0]],
      [-100, { m: 9940, c: 9985, d: 10_000 }, [0, 0, 0]],
      [-50, { m: 9970, c: 9993, d: 10_000 }, [0, 0, 0]],
    ] as const) {
      const { ctx, u, p } = setup(
        { b: { metal: 1 }, res: rich },
        { roundDemolitionRefund: refund },
      );
      demolish(ctx, u, { key: 'metal' });
      expect(p().res, String(refund)).toEqual(res);
      expect(p().bq!.back, String(refund)).toEqual(back);
    }
  });

  it('takes the time share of the round (D3)', () => {
    const { ctx, u, p } = setup(
      { b: { metal: 1 }, res: rich },
      { roundDemolitionTime: 200 },
    );
    demolish(ctx, u, { key: 'metal' });
    expect(p().bq!.end - p().bq!.start).toBe(43200);
  });

  it('is refused with a negative factor and too few resources, as for building', () => {
    const { ctx, u, p } = setup(
      { b: { metal: 1 }, res: { m: 59, c: 15, d: 0 } },
      { roundDemolitionRefund: -100 },
    );
    expect(() => demolish(ctx, u, { key: 'metal' })).toThrow(
      'Der Zehnte reicht nicht aus.',
    );
    expect(p().bq).toBeNull();
    expect(p().b.metal).toBe(1);
  });

  it('is refused while the queue runs or the building is in use (D5)', () => {
    const { ctx, u } = setup({ b: { metal: 1, crystal: 1 }, res: rich });
    demolish(ctx, u, { key: 'metal' });
    expect(() => demolish(ctx, u, { key: 'crystal' })).toThrow(
      'Es wird bereits gebaut.',
    );
    expect(() => A.build(ctx, u, { key: 'crystal' })).toThrow(
      'Es wird bereits gebaut.',
    );
    const yard = setup({
      b: { robot: 2, yard: 1 },
      sq: [{ key: 'rl', n: 9, unit: 1e9 }],
      sqT: 1_000_000,
    });
    expect(() => demolish(yard.ctx, yard.u, { key: 'yard' })).toThrow(
      'Die Schiffsschmiede arbeitet gerade.',
    );
    const lab = setup({ b: { lab: 1 }, res: rich });
    A.research(lab.ctx, lab.u, { key: 'energy' });
    expect(() => demolish(lab.ctx, lab.u, { key: 'lab' })).toThrow(
      'Das Scholarium forscht gerade.',
    );
  });

  it('is refused when the fields would overflow (D5)', () => {
    const { ctx, u } = setup({
      diameter: 2000,
      b: { terraformer: 1, metal: 5 },
      res: rich,
    });
    expect(() => demolish(ctx, u, { key: 'terraformer' })).toThrow(
      'Keine freien Felder.',
    );
    expect(demolish(ctx, u, { key: 'metal' })).toBeNull();
  });

  it('queues the push of its end like an upgrade, under the planet and its start', () => {
    const { ctx, u, p } = setup({ b: { metal: 1 } });
    ctx.db
      .prepare(`INSERT INTO push_subscriptions VALUES (?, ?, 'k', 'a')`)
      .run('e_anna', u.id);
    const start = ctx.now();
    demolish(ctx, u, { key: 'metal' });
    expect(
      ctx.db.prepare('SELECT kind, event_key, due FROM push_jobs').all(),
    ).toEqual([
      { kind: 'buildings', event_key: `${p().id}:${start}`, due: p().bq!.end },
    ]);
  });

  it('is refused for what the interface never offers', () => {
    const { ctx, u, p } = setup({ b: { metal: 1 } });
    expect(() => demolish(ctx, u, { key: 'nope' })).toThrow(
      'Unbekanntes Gebäude.',
    );
    expect(() => demolish(ctx, u, { key: 'crystal' })).toThrow('Ungültig.');
    const moon = addMoon(ctx, p(), 1, ctx.now());
    ctx.planets.save({ ...moon, b: { moonbase: 1 } });
    expect(() =>
      demolish(ctx, u, { key: 'moonbase', planet: moon.id }),
    ).toThrow('Ungültig.');
  });

  it('never tears down a building of a moon, the Warp-Tor included (#53, #230)', () => {
    const { ctx, u, p } = setup({ b: { metal: 1 } });
    const moon = addMoon(ctx, p(), 1, ctx.now());
    const b = { moonbase: 2, phalanx: 1, jumpgate: 3 };
    ctx.planets.save({ ...moon, b, res: rich });
    for (const key of Object.keys(b))
      expect(() => demolish(ctx, u, { key, planet: moon.id }), key).toThrow(
        'Ungültig.',
      );
    // Nothing changed: the levels stand, no order runs, nothing was paid.
    const after = ctx.planets.get(moon.id)!;
    expect(after.b).toEqual(b);
    expect(after.bq).toBeNull();
    expect(after.res).toEqual(rich);
  });

  it('refuses the Raketenkrypta below the places of its missiles, the queue counted, and removes nothing (#54, 2026-11-21)', () => {
    const { ctx, u, p } = setup({
      b: { silo: 2, yard: 1 },
      def: { abm: 6, ipm: 2 },
      sq: [{ key: 'abm', n: 1, unit: 100 }],
      res: rich,
    });
    // 6 + 4 + 1 = 11 places of the 10 left at level 1.
    expect(() => demolish(ctx, u, { key: 'silo' })).toThrow(
      'Die Raketenkrypta lagert zu viele Raketen.',
    );
    expect(p().b.silo).toBe(2);
    expect(p().def).toMatchObject({ abm: 6, ipm: 2 });
    expect(p().bq).toBeNull();
    expect(p().res).toEqual(rich);
    // The queue gone, 10 places are taken: exactly as many as are left.
    ctx.planets.save({ ...p(), sq: [] });
    expect(demolish(ctx, u, { key: 'silo' })).toBeNull();
    expect(p().bq).toMatchObject({ key: 'silo', lvl: 1 });
    expect(p().def).toMatchObject({ abm: 6, ipm: 2 });
  });

  it('words every code', () => {
    expect(DEMOLITION_ERROR).toEqual({
      place: 'Ungültig.',
      none: 'Ungültig.',
      fields: 'Keine freien Felder.',
      busy: 'Es wird bereits gebaut.',
      yardBusy: 'Die Schiffsschmiede arbeitet gerade.',
      labBusy: 'Das Scholarium forscht gerade.',
      siloBusy: 'Die Raketenkrypta lagert zu viele Raketen.',
      cost: 'Der Zehnte reicht nicht aus.',
    });
  });

  it('can be cancelled: what the start paid comes back and the level stays [V]', () => {
    const neg = setup(
      { b: { metal: 1 }, res: rich },
      { roundDemolitionRefund: -100 },
    );
    demolish(neg.ctx, neg.u, { key: 'metal' });
    expect(A.cancelBuild(neg.ctx, neg.u, {})).toBeNull();
    expect(neg.p().res).toEqual(rich);
    expect(neg.p().bq).toBeNull();
    expect(neg.p().b.metal).toBe(1);
    const pos = setup({ b: { metal: 1 }, res: rich });
    demolish(pos.ctx, pos.u, { key: 'metal' });
    pos.ctx.clock.t += 1000;
    A.cancelBuild(pos.ctx, pos.u, {});
    pos.ctx.clock.t += 1e9;
    expect(A.mine(pos.ctx, pos.u).b.metal).toBe(1);
  });

  it('lowers the points by the cost of the level (D6)', () => {
    const { ctx, u, p } = setup({ b: { yard: 2 }, res: rich });
    // Levels 1 and 2 of the shipyard: 700 + 1,400 resources.
    expect(pointsMap(ctx)[u.id]).toBe(2);
    demolish(ctx, u, { key: 'yard' });
    ctx.clock.t = p().bq!.end;
    expect(pointsMap(ctx)[u.id]).toBe(0);
  });

  it('runs through the list of actions', () => {
    const { ctx, u, p } = setup({ b: { metal: 1 }, res: rich });
    expect(runAction(ctx, u.id, { type: 'demolish', key: 'metal' })).toBeNull();
    expect(p().bq).toMatchObject({ key: 'metal', lvl: 0 });
  });
});

describe('the settings of a demolition per round (#202, D4, X1)', () => {
  function world() {
    const ctx = testCtx();
    const admin = addUser(ctx, 'Admin', { admin: true });
    addPlanet(ctx, admin.id);
    return { ctx, admin };
  }

  it('start with +50 % and 50 % in an existing universe', () => {
    const { ctx } = world();
    expect(roundRules(ctx)).toMatchObject({
      demolitionRefund: 50,
      demolitionTime: 50,
    });
  });

  it('are set in „Neue Runde“, the current ones without a choice', () => {
    const { ctx, admin } = world();
    const event = {} as AuditEntry;
    runAction(
      ctx,
      admin.id,
      {
        type: 'reset',
        demolition: { demolitionRefund: -40, demolitionTime: 120 },
      },
      event,
    );
    expect(roundRules(ctx)).toMatchObject({
      demolitionRefund: -40,
      demolitionTime: 120,
    });
    expect(ctx.admin.universe()).toMatchObject({
      roundDemolitionRefund: -40,
      roundDemolitionTime: 120,
    });
    expect(event.detail).toMatchObject({
      before: { demolitionRefund: 50, demolitionTime: 50 },
      after: { demolitionRefund: -40, demolitionTime: 120 },
    });
    runAction(ctx, admin.id, { type: 'reset' });
    expect(roundRules(ctx)).toMatchObject({
      demolitionRefund: -40,
      demolitionTime: 120,
    });
  });

  it('refuse values outside their range in „Neue Runde“, with the words of the universe settings', () => {
    const { ctx, admin } = world();
    expect(() =>
      runAction(ctx, admin.id, {
        type: 'reset',
        demolition: { demolitionRefund: 101, demolitionTime: 0 },
      }),
    ).toThrow(
      'Rückbau-Erstattung (%): ganze Zahl von -100 bis 100. Rückbau-Dauer (% der Bauzeit): ganze Zahl von 1 bis 200.',
    );
    expect(roundRules(ctx)).toMatchObject({
      number: 1,
      demolitionRefund: 50,
      demolitionTime: 50,
    });
  });

  it('refuse each value on its own, and a group sent incomplete, with the range wording', () => {
    const { ctx, admin } = world();
    const refusedWith = (demolition: unknown): string => {
      try {
        runAction(ctx, admin.id, { type: 'reset', demolition });
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    };
    expect(refusedWith({ demolitionRefund: -101, demolitionTime: 50 })).toBe(
      'Rückbau-Erstattung (%): ganze Zahl von -100 bis 100.',
    );
    expect(refusedWith({ demolitionRefund: 50, demolitionTime: 201 })).toBe(
      'Rückbau-Dauer (% der Bauzeit): ganze Zahl von 1 bis 200.',
    );
    expect(refusedWith({ demolitionRefund: 50 })).toBe(
      'Rückbau-Dauer (% der Bauzeit): ganze Zahl von 1 bis 200.',
    );
    expect(refusedWith({ demolitionTime: 50 })).toBe(
      'Rückbau-Erstattung (%): ganze Zahl von -100 bis 100.',
    );
    expect(roundRules(ctx)).toMatchObject({
      number: 1,
      demolitionRefund: 50,
      demolitionTime: 50,
    });
  });

  it('are rows of the universe settings, selected by key, in the order of the registry (X1)', () => {
    const rows = [
      {
        key: 'roundDemolitionRefund',
        label: 'Rückbau-Erstattung (%)',
        min: -100,
        max: 100,
        def: 50,
      },
      {
        key: 'roundDemolitionTime',
        label: 'Rückbau-Dauer (% der Bauzeit)',
        min: 1,
        max: 200,
        def: 50,
      },
    ];
    // Selected by key, never by position: other features add live rows too.
    const mine = (specs: readonly { key: string }[]) =>
      specs.filter((s) => rows.some((r) => r.key === s.key));
    expect(mine(liveSpecs())).toEqual(rows);
    expect(mine(UNIVERSE_SPECS)).toEqual(rows);
  });

  it('stay editable in the universe settings during the round', () => {
    const { ctx, admin } = world();
    const settings = {
      ...DEFAULT_UNIVERSE,
      roundDemolitionRefund: 0,
      roundDemolitionTime: 200,
    };
    expect(runAction(ctx, admin.id, { type: 'settings', settings })).toBe(
      'Einstellungen gespeichert.',
    );
    expect(roundRules(ctx)).toMatchObject({
      demolitionRefund: 0,
      demolitionTime: 200,
    });
    expect(() =>
      runAction(ctx, admin.id, {
        type: 'settings',
        settings: { ...settings, roundDemolitionRefund: -101 },
      }),
    ).toThrow('Rückbau-Erstattung (%): ganze Zahl von -100 bis 100.');
  });
});
