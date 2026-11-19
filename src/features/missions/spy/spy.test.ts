// Auspex-Erkundung (#116, #175): only Spähschädel and only from Auspex-Lehre
// 1; a report for the spy with the target's activity, a warning for the
// defender. Detected probes fight a battle, and only survivors report.
import { describe, expect, it } from 'vitest';
import type { Fleet, Levels } from '../../../core/types.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../../../server/test-helpers.ts';
import { spyScore } from '../../../core/spy.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

const fleet = (ships: Levels, spy = 1) => ({
  owner: 'a',
  from: 'p1',
  ships,
  research: { spy },
});

interface Target {
  ships?: Levels;
  def?: Levels;
  attSpy?: number;
  defSpy?: number;
}

function setup(probes: number, x: Target = {}) {
  const ctx = testCtx(1_000_000, 7);
  addUser(ctx, 'Anna');
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  const t = addPlanet(ctx, 'u_Bert', {
    g: 1,
    s: 2,
    p: 6,
    name: 'Beta',
    ships: x.ships ?? {},
    def: x.def ?? { rl: 4 },
    b: { metal: 3 },
    res: { m: 10.7, c: 20.2, d: 30.9 },
  });
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: t.id,
    toC: { g: 1, s: 2, p: 6 },
    mission: 'spy',
    ships: { probe: probes },
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  const att = { name: 'Anna', research: { spy: x.attSpy ?? 1 }, rq: null };
  const def = { name: 'Bert', research: { spy: x.defSpy ?? 0 }, rq: null };
  return { ctx, f, at: { t, att, def } };
}

/** The random numbers given first, then the seeded stream. */
function draws(ctx: ReturnType<typeof testCtx>, first: number[]): void {
  const rest = ctx.rng;
  ctx.rng = () => first.shift() ?? rest();
}

const titles = (ctx: ReturnType<typeof testCtx>, uid: string) =>
  ctx.reports.ofPlayer(uid).map((r) => r.title);

describe('spy', () => {
  it('has the data of today: its place, target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 30,
      target: 'foreign',
      cargo: false,
      returns: true,
      silent: true,
      alertsGuild: false,
    });
  });

  it('flies only with Spähschädel', () => {
    expect(canSend(fleet({ probe: 3 }))).toBeUndefined();
    expect(canSend(fleet({ probe: 3, sc: 1 }))).toBe('probesOnly');
    expect(canSend(fleet({ lc: 1 }))).toBe('probesOnly');
  });

  it('flies only from Auspex-Lehre 1 (#175, Q1)', () => {
    expect(canSend(fleet({ probe: 3 }, 0))).toBe('noSpyTech');
    expect(canSend({ owner: 'a', from: 'p1', ships: { probe: 1 } })).toBe(
      'noSpyTech',
    );
    expect(canSend(fleet({ probe: 3 }, 2))).toBeUndefined();
    expect(canSend(fleet({ lc: 1 }, 0))).toBe('probesOnly');
  });

  it('scores probes and technology', () => {
    expect(spyScore(3, 2)).toBe(7);
    expect(spyScore(3, -2)).toBe(-1);
  });

  it('reports what the score shows and flies back when not seen', () => {
    const { ctx, f, at } = setup(5);
    onArrive(ctx, f, at);
    const [report] = ctx.reports.ofPlayer('u_Anna');
    expect(report).toMatchObject({
      time: f.arr,
      type: 'spy',
      title: 'Auspex-Bericht von Beta [1:2:6]',
      defName: 'Bert',
      res: { m: 10, c: 20, d: 30 },
      activity: null,
      counter: 0,
      ships: {},
      def: { rl: 4 },
      b: { metal: 3 },
    });
    expect(report).not.toHaveProperty('r');
    expect(report).not.toHaveProperty('lost');
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      {
        title: 'Auspex-Aktivität',
        text: 'Eine fremde Flotte von Anna [1:1:5] wurde in der Nähe deines Planeten Beta [1:2:6] gesichtet. Chance auf Auspex-Abwehr: 0 %.',
      },
    ]);
    expect(ctx.fleets.get('f1')?.state).toBe('back');
  });

  it('shows the activity of the target by the rule of the Sternenkarte (D5, Q3)', () => {
    const { ctx, f, at } = setup(1);
    ctx.planets.markActive([at.t.id], f.arr - 20 * 60_000);
    onArrive(ctx, f, at);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      activity: { minutes: 20 },
    });
    const again = setup(1);
    again.ctx.planets.markActive([again.at.t.id], again.f.arr - 60_000);
    onArrive(again.ctx, again.f, again.at);
    expect(again.ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      activity: { recent: true },
    });
    const old = setup(1);
    old.ctx.planets.markActive([old.at.t.id], old.f.arr - 60 * 60_000);
    onArrive(old.ctx, old.f, old.at);
    expect(old.ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      activity: null,
    });
  });

  it('draws the chance up to the maximum and shows it rounded (D1, D2)', () => {
    // 40 probes, 100 ships, target 2 against spy 1: (40/4)·2·2 = 40 %.
    const { ctx, f, at } = setup(40, { ships: { lc: 100 }, defSpy: 2 });
    draws(ctx, [0.5, 0.99]);
    onArrive(ctx, f, at);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      type: 'spy',
      counter: 20,
    });
    expect(ctx.reports.ofPlayer('u_Bert')[0]!.text).toMatch(
      /Chance auf Auspex-Abwehr: 20 %\.$/,
    );
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ships: { probe: 40 },
    });
  });

  it('a target at level 0 never detects (Q1b)', () => {
    const { ctx, f, at } = setup(1000, { ships: { lc: 10000 } });
    draws(ctx, [0.99, 0]);
    onArrive(ctx, f, at);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      type: 'spy',
      counter: 0,
    });
    expect(ctx.fleets.get('f1')?.state).toBe('back');
  });

  it('detected probes that die give only the battle reports (D3, D4)', () => {
    const { ctx, f, at } = setup(4, { ships: { lc: 100 }, defSpy: 5 });
    draws(ctx, [0.5, 0]);
    onArrive(ctx, f, at);
    expect(titles(ctx, 'u_Anna')).toEqual([
      'Kontakt abgebrochen – deine Spähschädel wurden bei [1:2:6] entdeckt und zerstört.',
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      type: 'battle',
      attName: 'Anna',
      defName: 'Bert',
      attBefore: { probe: 4 },
      attAfter: {},
      defBefore: { lc: 100, rl: 4 },
      winner: 'def',
      debris: { m: 0, c: 1200 },
    });
    expect(ctx.reports.ofPlayer('u_Anna')[0]).not.toHaveProperty('loot');
    expect(titles(ctx, 'u_Bert').sort()).toEqual([
      'Auspex-Aktivität',
      'Kampfbericht Beta [1:2:6] – Spähschädel von Anna',
    ]);
    expect(
      ctx.reports.ofPlayer('u_Bert').find((r) => r.type === 'info')!.text,
    ).toMatch(
      /Chance auf Auspex-Abwehr: 5 %\. Die Spähschädel wurden abgeschossen!$/,
    );
    expect(ctx.debris.get('d1_2_6')).toMatchObject({ m: 0, c: 1200 });
    expect(ctx.planets.get(at.t.id)).toMatchObject({
      ships: { lc: 100 },
      def: { rl: 4 },
    });
    expect(ctx.fleets.get('f1')).toBeNull();
  });

  it('probes that survive the battle still report (owner, 2026-11-17)', () => {
    // A small shield dome hits one probe for 1 per round, too little.
    const { ctx, f, at } = setup(1, { def: { ssd: 1 }, defSpy: 8 });
    draws(ctx, [0.9, 0]);
    onArrive(ctx, f, at);
    expect(titles(ctx, 'u_Anna')).toEqual([
      'Auspex-Bericht von Beta [1:2:6]',
      'Kampfbericht [1:2:6] – unentschieden',
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({ counter: 2 });
    expect(ctx.reports.ofPlayer('u_Anna')[1]).toMatchObject({
      winner: 'draw',
      rounds: 6,
      attAfter: { probe: 1 },
    });
    expect(
      ctx.reports.ofPlayer('u_Bert').find((r) => r.type === 'info')!.text,
    ).not.toContain('abgeschossen');
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ships: { probe: 1 },
    });
  });

  it('a detected spying at a target without ships and defense fights no battle', () => {
    const { ctx, f, at } = setup(4, { def: {}, defSpy: 30 });
    draws(ctx, [0.9, 0]);
    onArrive(ctx, f, at);
    expect(titles(ctx, 'u_Anna')).toEqual(['Auspex-Bericht von Beta [1:2:6]']);
    expect(titles(ctx, 'u_Bert')).toEqual(['Auspex-Aktivität']);
    expect(ctx.debris.get('d1_2_6')).toBeNull();
    expect(ctx.fleets.get('f1')?.state).toBe('back');
  });

  it('pushes the report to the spy and the activity to the defender (#192)', () => {
    const { ctx, f, at } = setup(5);
    subscribePush(ctx, 'u_Anna');
    subscribePush(ctx, 'u_Bert');
    onArrive(ctx, f, at);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
      { user: 'u_Bert', kind: 'messages', topic: 'spied' },
    ]);
  });

  it('pushes the battle to both sides as fleet and spied (#192)', () => {
    const { ctx, f, at } = setup(4, { ships: { lc: 100 }, defSpy: 5 });
    subscribePush(ctx, 'u_Anna');
    subscribePush(ctx, 'u_Bert');
    draws(ctx, [0.5, 0]);
    onArrive(ctx, f, at);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
      { user: 'u_Bert', kind: 'messages', topic: 'spied' },
      { user: 'u_Bert', kind: 'messages', topic: 'spied' },
    ]);
  });
});

/** Carl, an ally of Bert, has a fleet of `ships` that holds at Bert's planet (#55). */
function guard(ctx: ReturnType<typeof testCtx>, ships: Levels): Fleet {
  addUser(ctx, 'Carl');
  addPlanet(ctx, 'u_Carl', { g: 1, s: 3, p: 4 });
  const h: Fleet = {
    id: 'h1',
    owner: 'u_Carl',
    from: 'p1_3_4',
    fromC: { g: 1, s: 3, p: 4 },
    to: 'p1_2_6',
    toC: { g: 1, s: 2, p: 6 },
    mission: 'hold',
    ships,
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 1000,
    arr: ctx.now() - 500,
    ret: ctx.now() + 3_600_000,
    state: 'hold',
    recalled: false,
    fuel: 1,
    hold: 3_600_000,
  };
  ctx.fleets.save(h);
  return h;
}

describe('spy: detected probes at a planet where fleets hold (#55, owner, 2026-11-19)', () => {
  it('fight the fleet that holds with the planet; its owner gets the report of the defender', () => {
    const { ctx, f, at } = setup(4, { ships: { lc: 100 }, defSpy: 5 });
    const h = guard(ctx, { bs: 5 });
    draws(ctx, [0.5, 0]);
    onArrive(ctx, f, at);
    const battle = ctx.reports.ofPlayer('u_Anna')[0]!;
    expect(battle).toMatchObject({
      type: 'battle',
      title:
        'Kontakt abgebrochen – deine Spähschädel wurden bei [1:2:6] entdeckt und zerstört.',
      participants: ['u_Anna', 'u_Bert', 'u_Carl'],
      winner: 'def',
      defBefore: { lc: 100, rl: 4 },
      held: [
        {
          name: 'Carl',
          before: { bs: 5 },
          after: { bs: 5 },
          tech: { weapons: 0, shield: 0, armor: 0 },
        },
      ],
      // Only the probes are lost: 30 % of 4 × 1,000 Psikristall.
      debris: { m: 0, c: 1200 },
    });
    // The report of the defender goes to the host and to the owner of the fleet.
    expect(ctx.reports.ofPlayer('u_Carl')).toMatchObject([
      {
        type: 'battle',
        title: 'Kampfbericht Beta [1:2:6] – Spähschädel von Anna',
        held: [{ name: 'Carl', before: { bs: 5 }, after: { bs: 5 } }],
      },
    ]);
    expect(titles(ctx, 'u_Bert').sort()).toEqual([
      'Auspex-Aktivität',
      'Kampfbericht Beta [1:2:6] – Spähschädel von Anna',
    ]);
    // It holds on with the ships it kept, and the probes are gone.
    expect(ctx.fleets.get(h.id)).toEqual(h);
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.debris.get('d1_2_6')).toMatchObject({ m: 0, c: 1200 });
  });

  it('push the battle to the owner of the fleet as „spied“', () => {
    const { ctx, f, at } = setup(4, { ships: { lc: 100 }, defSpy: 5 });
    guard(ctx, { bs: 5 });
    subscribePush(ctx, 'u_Carl');
    draws(ctx, [0.5, 0]);
    onArrive(ctx, f, at);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Carl', kind: 'messages', topic: 'spied' },
    ]);
  });

  it('cost the fleet that holds its losses, and its debris lies there; a fleet without survivors is gone', () => {
    // A strong attacker makes the losses exact: five Weltenbrecher destroy
    // the Kleiner Frachter and the three Lichte Jäger (that a spy flies with
    // probes only is the check of `canSend`, not of the arrival).
    const { ctx, f, at } = setup(1, { ships: { sc: 1 }, def: {}, defSpy: 30 });
    f.ships = { probe: 1, dstar: 5 };
    ctx.fleets.save(f);
    const h = guard(ctx, { lf: 3 });
    draws(ctx, [0.9, 0]);
    onArrive(ctx, f, at);
    const battle = ctx.reports.ofPlayer('u_Anna')[1]!;
    expect(battle).toMatchObject({
      type: 'battle',
      winner: 'att',
      held: [{ name: 'Carl', before: { lf: 3 }, after: {} }],
      // 30 % of the Kleiner Frachter (2,000 / 2,000) and of the three Lichte
      // Jäger (3 × 3,000 / 1,000).
      debris: { m: 600 + 2700, c: 600 + 900 },
    });
    expect(ctx.fleets.get(h.id)).toBeNull();
    expect(ctx.reports.ofPlayer('u_Carl')[0]).toMatchObject({
      held: [{ name: 'Carl', before: { lf: 3 }, after: {} }],
    });
  });

  it('fight a planet without ships and defense when a fleet holds there', () => {
    const { ctx, f, at } = setup(4, { def: {}, defSpy: 30 });
    guard(ctx, { bs: 5 });
    draws(ctx, [0.9, 0]);
    onArrive(ctx, f, at);
    expect(titles(ctx, 'u_Anna')).toEqual([
      'Kontakt abgebrochen – deine Spähschädel wurden bei [1:2:6] entdeckt und zerstört.',
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      winner: 'def',
      defBefore: {},
      held: [{ name: 'Carl', before: { bs: 5 }, after: { bs: 5 } }],
    });
    expect(titles(ctx, 'u_Carl')).toEqual([
      'Kampfbericht Beta [1:2:6] – Spähschädel von Anna',
    ]);
    expect(ctx.fleets.get('f1')).toBeNull();
  });

  it('give the same battle as before when no fleet holds there; a fleet of the spy himself that holds there stays out', () => {
    const { ctx, f, at } = setup(4, { ships: { lc: 100 }, defSpy: 5 });
    // Anna's own fleet holds at the planet: it is no defender of it.
    const mine = guard(ctx, { bs: 5 });
    ctx.fleets.save({ ...mine, id: 'mine', owner: 'u_Anna' });
    ctx.fleets.delete(mine.id);
    draws(ctx, [0.5, 0]);
    onArrive(ctx, f, at);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).not.toHaveProperty('held');
    expect(ctx.reports.ofPlayer('u_Anna')[0]!.participants).toEqual([
      'u_Anna',
      'u_Bert',
    ]);
    expect(ctx.reports.ofPlayer('u_Carl')).toEqual([]);
    expect(ctx.fleets.get('mine')).toMatchObject({ state: 'hold' });
  });
});
