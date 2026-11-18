// Holding on the server (#55): who may hold under the admin's setting of the
// round, the send with its holding time and fuel, the end of holding, the
// recall, the battle with the fleets that hold (a report per party, loot of
// the planet first, then of the held cargo) and what the host sees.
import { describe, expect, it } from 'vitest';
import { distance, fuelFor, holdFuel } from '../../core/flight.ts';
import { HOUR_MS } from '../../core/holding.ts';
import type { Fleet } from '../../core/types.ts';
import { type TestCtx, addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { arrive, tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { recall, send } from './fleet-actions.ts';
import { areFriends, heldAt, holdersAt, isAllyOf } from './holding.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';

const ANNA = { g: 1, s: 1, p: 5 };
const BERT = { g: 1, s: 2, p: 6 };
const CORA = { g: 1, s: 3, p: 7 };

/** Anna and Bert share a guild; Cora is in none. All have points enough against the noob protection. */
function setup(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { research: { energy: 10 } });
  addUser(ctx, 'Bert', { research: { energy: 10 } });
  addUser(ctx, 'Cora', { research: { energy: 10 } });
  addUser(ctx, 'Ada', { admin: true });
  addPlanet(ctx, 'u_Anna', {
    ...ANNA,
    ships: { lf: 20, sc: 5, bs: 10 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  addPlanet(ctx, 'u_Bert', { ...BERT, name: 'Beta' });
  addPlanet(ctx, 'u_Cora', { ...CORA, ships: { lf: 10, bs: 60 } });
  ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Anna');
  ctx.guilds.apply('u_Bert', 'g1');
  ctx.guilds.accept('u_Bert');
  return ctx;
}

const hold = (over: Record<string, unknown> = {}) => ({
  planet: 'p1_1_5',
  mission: 'hold',
  ships: { lf: 2 },
  to: BERT,
  pct: 10,
  cargo: {},
  hold: 2,
  ...over,
});

const user = (ctx: TestCtx, name: string) => ctx.players.get(`u_${name}`)!;

/** A fleet of `owner` that holds at Bert's planet now. */
function holding(
  ctx: TestCtx,
  id: string,
  owner: string,
  over: Partial<Fleet> = {},
): Fleet {
  const f: Fleet = {
    id,
    owner,
    from: 'p1_1_5',
    fromC: ANNA,
    to: 'p1_2_6',
    toC: BERT,
    mission: 'hold',
    ships: { lf: 1 },
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 1000,
    arr: ctx.now() - 500,
    ret: ctx.now() + HOUR_MS,
    state: 'hold',
    recalled: false,
    fuel: 3,
    hold: HOUR_MS,
    ...over,
  };
  ctx.fleets.save(f);
  return f;
}

describe('who may hold (#55, Q2)', () => {
  it('is a guild member while guilds are on, with the default guild and friends', () => {
    const ctx = setup();
    expect(roundRules(ctx).allies).toBe(3);
    expect(isAllyOf(ctx, 'u_Anna', 'u_Bert')).toBe(true);
    expect(isAllyOf(ctx, 'u_Bert', 'u_Anna')).toBe(true);
    expect(isAllyOf(ctx, 'u_Anna', 'u_Cora')).toBe(false);
    ctx.admin.putSettings([['roundGuilds', 0]]);
    expect(isAllyOf(ctx, 'u_Anna', 'u_Bert')).toBe(false);
  });
  it('is no applicant of the guild', () => {
    const ctx = setup();
    // Without a guild, from either side.
    expect(isAllyOf(ctx, 'u_Cora', 'u_Anna')).toBe(false);
    ctx.guilds.apply('u_Cora', 'g1');
    expect(isAllyOf(ctx, 'u_Anna', 'u_Cora')).toBe(false);
    expect(isAllyOf(ctx, 'u_Cora', 'u_Anna')).toBe(false);
  });
  it('is no member of another guild', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'OTH', 'Andere', '', 'u_Cora');
    expect(isAllyOf(ctx, 'u_Anna', 'u_Cora')).toBe(false);
    expect(isAllyOf(ctx, 'u_Cora', 'u_Bert')).toBe(false);
  });
  it('counts a fleet as holding only once it holds, on its way it defends nothing', () => {
    const ctx = setup();
    holding(ctx, 'f_out', 'u_Anna', { state: 'out' });
    expect(heldAt(ctx, 'p1_2_6')).toEqual([]);
    expect(holdersAt(ctx, 'p1_2_6')).toEqual(['u_Anna']);
  });
  it('follows the setting of the round: friends only leaves the guild out', () => {
    const ctx = setup();
    ctx.admin.putSettings([['roundAllies', 1]]);
    expect(isAllyOf(ctx, 'u_Anna', 'u_Bert')).toBe(true);
    ctx.admin.putSettings([['roundAllies', 2]]);
    expect(isAllyOf(ctx, 'u_Anna', 'u_Bert')).toBe(false);
  });
  it('knows no friends before the buddy list (#227)', () => {
    const ctx = setup();
    expect(areFriends(ctx, 'u_Anna', 'u_Bert')).toBe(false);
  });
});

describe('sending a fleet to hold', () => {
  it('flies to a guild member for the chosen hours and pays their fuel at the launch', () => {
    const ctx = setup();
    const t = ctx.now();
    expect(send(ctx, user(ctx, 'Anna'), hold({ cargo: { m: 50 } }))).toBe(
      'Flotte unterwegs nach [1:2:6].',
    );
    const f = ctx.fleets.all()[0]!;
    const ms = f.arr - t;
    const fuel =
      fuelFor({ lf: 2 }, distance(ANNA, BERT), 10) + holdFuel({ lf: 2 }, 2);
    expect(holdFuel({ lf: 2 }, 2)).toBe(8);
    expect(f).toMatchObject({
      mission: 'hold',
      state: 'out',
      hold: 2 * HOUR_MS,
      ret: t + 2 * ms + 2 * HOUR_MS,
      fuel,
      cargo: { m: 50, c: 0, d: 0 },
    });
    expect(ctx.planets.home('u_Anna')!.res.d).toBe(30000 - fuel);
  });
  it('takes every classic holding time and refuses any other', () => {
    for (const h of [0, 1, 2, 4, 8, 16, 32]) {
      const ctx = setup();
      send(ctx, user(ctx, 'Anna'), hold({ hold: h }));
      expect(ctx.fleets.all()[0]!.hold).toBe(h * HOUR_MS);
    }
    for (const h of [3, -1, 64, '2', undefined]) {
      const ctx = setup();
      expect(() => send(ctx, user(ctx, 'Anna'), hold({ hold: h }))).toThrow(
        'Bitte eine Haltezeit auswählen.',
      );
    }
  });
  it('gives no other mission a holding time', () => {
    const ctx = setup();
    send(ctx, user(ctx, 'Anna'), hold({ mission: 'transport', hold: 32 }));
    const f = ctx.fleets.all()[0]!;
    expect(f).not.toHaveProperty('hold');
    expect(f.ret - f.dep).toBe(2 * (f.arr - f.dep));
  });
  it('refuses a player who is no ally, named by the setting of the round', () => {
    const ctx = setup();
    const anna = user(ctx, 'Anna');
    const to = (settings: number, target = CORA) => {
      ctx.admin.putSettings([['roundAllies', settings]]);
      return () => send(ctx, anna, hold({ to: target }));
    };
    expect(to(3)).toThrow(
      'Wache stellen nur bei Gildenmitgliedern und Freunden.',
    );
    expect(to(1)).toThrow('Wache stellen nur bei Gildenmitgliedern.');
    expect(to(2, BERT)).toThrow('Wache stellen nur bei Freunden.');
    expect(ctx.fleets.all()).toEqual([]);
  });
  it('refuses the own planet and a free position', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 8, name: 'Kolonie' });
    expect(() =>
      send(ctx, user(ctx, 'Anna'), hold({ to: { g: 1, s: 1, p: 8 } })),
    ).toThrow('Wache stellen nur bei Gildenmitgliedern und Freunden.');
    expect(() =>
      send(ctx, user(ctx, 'Anna'), hold({ to: { g: 1, s: 4, p: 8 } })),
    ).toThrow('An dieser Position gibt es keinen Planeten.');
  });
  it('refuses a guild member in the noob protection (#55 [V])', () => {
    const ctx = setup();
    ctx.players.save({ ...user(ctx, 'Bert'), research: {} });
    expect(() => send(ctx, user(ctx, 'Anna'), hold())).toThrow(
      'Dieser Spieler steht unter Noobschutz.',
    );
  });
  it('keeps the limits of a planet: 15 fleets of four players besides the owner', () => {
    const ctx = setup();
    for (const name of ['Dora', 'Emil', 'Finn']) addUser(ctx, name);
    const others = ['u_Cora', 'u_Dora', 'u_Emil', 'u_Finn'];
    others.forEach((o, i) => holding(ctx, `h${i}`, o));
    expect(holdersAt(ctx, 'p1_2_6')).toEqual(others);
    expect(() => send(ctx, user(ctx, 'Anna'), hold())).toThrow(
      'An diesem Planeten halten bereits Flotten von 4 Spielern.',
    );
    ctx.fleets.delete('h3');
    // On their way they count too.
    for (let i = 3; i < 15; i++)
      holding(ctx, `h${i}`, 'u_Cora', { state: 'out', arr: ctx.now() + 9 });
    expect(holdersAt(ctx, 'p1_2_6')).toHaveLength(15);
    expect(() => send(ctx, user(ctx, 'Anna'), hold())).toThrow(
      'An diesem Planeten halten bereits 15 Flotten.',
    );
    ctx.fleets.delete('h14');
    send(ctx, user(ctx, 'Anna'), hold());
    expect(holdersAt(ctx, 'p1_2_6')).toHaveLength(15);
  });
  it('counts neither fleets on their way home nor other missions at the planet', () => {
    const ctx = setup();
    holding(ctx, 'back', 'u_Cora', { state: 'back' });
    holding(ctx, 'transport', 'u_Cora', {
      mission: 'transport',
      state: 'out',
    });
    expect(holdersAt(ctx, 'p1_2_6')).toEqual([]);
    expect(heldAt(ctx, 'p1_2_6')).toEqual([]);
  });
});

describe('holding', () => {
  it('starts at the arrival, ends after the holding time and comes home', () => {
    const ctx = setup();
    send(ctx, user(ctx, 'Anna'), hold({ hold: 1 }));
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.fleets.get(f.id)!.state).toBe('hold');
    expect(heldAt(ctx, 'p1_2_6').map((x) => x.id)).toEqual([f.id]);
    ctx.clock.t = f.arr + HOUR_MS - 1;
    expect(tick(ctx)).toBe(0);
    ctx.clock.t = f.arr + HOUR_MS;
    tick(ctx);
    expect(ctx.fleets.get(f.id)).toMatchObject({ state: 'back', ret: f.ret });
    ctx.clock.t = f.ret;
    tick(ctx);
    expect(ctx.fleets.get(f.id)).toBeNull();
    expect(ctx.planets.home('u_Anna')!.ships.lf).toBe(20);
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.title)).toEqual([
      'Rückkehr zu Planet u_Anna [1:1:5]',
    ]);
  });
  it('holds for no time at 0 hours and flies home at the next beat', () => {
    const ctx = setup();
    send(ctx, user(ctx, 'Anna'), hold({ hold: 0 }));
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.fleets.get(f.id)!.state).toBe('hold');
    tick(ctx);
    expect(ctx.fleets.get(f.id)!.state).toBe('back');
  });
  it('can be called back while it holds: home after the time of its flight there', () => {
    const ctx = setup();
    const f = holding(ctx, 'h1', 'u_Anna');
    expect(recall(ctx, user(ctx, 'Anna'), { id: 'h1' })).toBe(
      'Flotte zurückgerufen.',
    );
    expect(ctx.fleets.get('h1')).toMatchObject({
      state: 'back',
      recalled: true,
      ret: ctx.now() + (f.arr - f.dep),
    });
  });
  it('cannot be called back once its holding time is over, nor by another player', () => {
    const ctx = setup();
    holding(ctx, 'h1', 'u_Anna', { hold: 500 });
    expect(() => recall(ctx, user(ctx, 'Anna'), { id: 'h1' })).toThrow(
      'Rückruf nicht mehr möglich.',
    );
    holding(ctx, 'h2', 'u_Anna');
    expect(() => recall(ctx, user(ctx, 'Bert'), { id: 'h2' })).toThrow(
      'Rückruf nicht mehr möglich.',
    );
  });
  it('is called back on its way out as before', () => {
    const ctx = setup();
    send(ctx, user(ctx, 'Anna'), hold({ hold: 32 }));
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t += 100;
    recall(ctx, user(ctx, 'Anna'), { id: f.id });
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      ret: ctx.now() + 100,
    });
  });
});

/** Cora attacks Bert's planet now with `ships`. */
function attack(ctx: TestCtx, ships: Fleet['ships']): Fleet {
  const f: Fleet = {
    id: 'att',
    owner: 'u_Cora',
    from: 'p1_3_7',
    fromC: CORA,
    to: 'p1_2_6',
    toC: BERT,
    mission: 'attack',
    ships,
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 100,
    arr: ctx.now(),
    ret: ctx.now() + 100,
    state: 'out',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  arrive(ctx, f);
  return f;
}

describe('a battle at a planet where fleets hold (#55)', () => {
  it('lets the fleet that holds defend with the owner; every party gets a report', () => {
    const ctx = setup();
    holding(ctx, 'h1', 'u_Anna', { ships: { bs: 5 } });
    attack(ctx, { lf: 1 });
    const title = 'Feindkontakt! Beta [1:2:6] wird von Cora angegriffen';
    expect(ctx.reports.ofPlayer('u_Cora').map((r) => r.title)).toEqual([
      'Kampfbericht [1:2:6] – verloren',
    ]);
    expect(ctx.reports.ofPlayer('u_Bert').map((r) => r.title)).toEqual([title]);
    const [report] = ctx.reports.ofPlayer('u_Anna');
    expect(report).toMatchObject({
      title,
      type: 'battle',
      winner: 'def',
      participants: ['u_Cora', 'u_Bert', 'u_Anna'],
      defBefore: {},
      defAfter: {},
      held: [
        {
          name: 'Anna',
          before: { bs: 5 },
          after: { bs: 5 },
          tech: { weapons: 0, shield: 0, armor: 0 },
        },
      ],
    });
    expect(ctx.fleets.get('h1')).toMatchObject({
      state: 'hold',
      ships: { bs: 5 },
    });
    expect(ctx.fleets.get('att')).toBeNull();
  });
  it('gives one report to an owner of several fleets, and each fleet its row', () => {
    const ctx = setup();
    holding(ctx, 'h1', 'u_Anna', { ships: { bs: 2 } });
    holding(ctx, 'h2', 'u_Anna', { ships: { bs: 3 } });
    attack(ctx, { lf: 1 });
    const reports = ctx.reports.ofPlayer('u_Anna');
    expect(reports).toHaveLength(1);
    expect((reports[0]!.held as unknown[]).length).toBe(2);
  });
  it('loots half of the planet first, then the cargo of the fleets that held; they are gone', () => {
    const ctx = setup();
    ctx.planets.save({
      ...ctx.planets.get('p1_2_6')!,
      res: { m: 10000, c: 6000, d: 0 },
    });
    holding(ctx, 'h1', 'u_Anna', {
      ships: { lf: 1 },
      cargo: { m: 1000, c: 2000, d: 500 },
    });
    attack(ctx, { bs: 50 });
    const r = ctx.reports.ofPlayer('u_Cora')[0]!;
    expect(r).toMatchObject({
      winner: 'att',
      loot: { m: 5000 + 1000, c: 3000 + 2000, d: 500 },
      held: [{ name: 'Anna', before: { lf: 1 }, after: {} }],
      // 30 % of the Lichter Jäger (3,000 Adamant, 1,000 Psikristall).
      debris: { m: 900, c: 300 },
    });
    expect(ctx.fleets.get('h1')).toBeNull();
    expect(ctx.planets.get('p1_2_6')!.res).toEqual({ m: 5000, c: 3000, d: 0 });
    expect(ctx.fleets.get('att')).toMatchObject({
      state: 'back',
      cargo: { m: 6000, c: 5000, d: 500 },
    });
  });
  it('takes of the held cargo only what the holds still carry', () => {
    const ctx = setup();
    ctx.planets.save({
      ...ctx.planets.get('p1_2_6')!,
      res: { m: 2000, c: 0, d: 0 },
    });
    holding(ctx, 'h1', 'u_Anna', {
      ships: { lf: 1 },
      cargo: { m: 100000, c: 0, d: 0 },
    });
    // One Schlachtschiff carries 1,500: 1,000 of the planet, 500 of the cargo.
    attack(ctx, { bs: 1 });
    expect(ctx.reports.ofPlayer('u_Cora')[0]!.loot).toEqual({
      m: 1500,
      c: 0,
      d: 0,
    });
  });
  it('leaves a fleet of the attacker that holds there out of the battle', () => {
    const ctx = setup();
    holding(ctx, 'mine', 'u_Cora', { ships: { bs: 1 } });
    attack(ctx, { lf: 1 });
    expect(ctx.fleets.get('mine')).toMatchObject({ ships: { bs: 1 } });
    expect(ctx.reports.ofPlayer('u_Cora')[0]).not.toHaveProperty('held');
  });
});

describe('a spy report of a planet where fleets hold (#55, owner, 2026-11-17)', () => {
  /** Cora, with Auspex-Lehre `spy`, scouts Bert's planet with `probes`. */
  function scout(ctx: TestCtx, spy: number, probes = 5) {
    ctx.players.save({ ...user(ctx, 'Cora'), research: { energy: 10, spy } });
    const f: Fleet = {
      id: 'spy',
      owner: 'u_Cora',
      from: 'p1_3_7',
      fromC: CORA,
      to: 'p1_2_6',
      toC: BERT,
      mission: 'spy',
      ships: { probe: probes },
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now() - 100,
      arr: ctx.now(),
      ret: ctx.now() + 100,
      state: 'out',
      recalled: false,
      fuel: 1,
    };
    ctx.fleets.save(f);
    arrive(ctx, f);
    return ctx.reports.ofPlayer('u_Cora')[0]!;
  }
  const withHeld = () => {
    const ctx = setup();
    ctx.planets.save({ ...ctx.planets.get('p1_2_6')!, ships: { lf: 2 } });
    holding(ctx, 'h1', 'u_Anna', { ships: { lf: 3, bs: 1 } });
    return ctx;
  };

  it('counts them into the fleet of the planet below the level of the round', () => {
    const r = scout(withHeld(), 1);
    expect(r.ships).toEqual({ lf: 5, bs: 1 });
    expect(r).not.toHaveProperty('held');
  });
  it('shows them apart from the level of the round on, 2 by default', () => {
    const r = scout(withHeld(), 2);
    expect(r.ships).toEqual({ lf: 2 });
    expect(r.held).toEqual([{ name: 'Anna', ships: { lf: 3, bs: 1 } }]);
  });
  it('follows the setting of the round', () => {
    const ctx = withHeld();
    ctx.admin.putSettings([['roundHeldSpy', 4]]);
    expect(scout(ctx, 3)).not.toHaveProperty('held');
  });
  it('shows nothing of them when the report shows no fleet', () => {
    const r = scout(withHeld(), 0, 1);
    expect(r).not.toHaveProperty('ships');
    expect(r).not.toHaveProperty('held');
  });
  it('shows the fleet of the planet as before without fleets that hold', () => {
    const ctx = setup();
    ctx.planets.save({ ...ctx.planets.get('p1_2_6')!, ships: { lf: 2 } });
    const r = scout(ctx, 5);
    expect(r.ships).toEqual({ lf: 2 });
    expect(r).not.toHaveProperty('held');
  });
});

describe('what the host sees', () => {
  it('shows a fleet that holds with its ships and holding time; one on its way without ships', () => {
    const ctx = setup();
    holding(ctx, 'h1', 'u_Anna', { ships: { bs: 2 } });
    holding(ctx, 'h2', 'u_Anna', { state: 'out', arr: ctx.now() + 50 });
    holding(ctx, 'h3', 'u_Anna', { state: 'back' });
    const fleets = stateFor(ctx, user(ctx, 'Bert')).fleets as Record<
      string,
      unknown
    >[];
    expect(fleets.map((f) => [f.id, f.state, f.ships, f.hold])).toEqual([
      ['h1', 'hold', { bs: 2 }, HOUR_MS],
      ['h2', 'out', {}, undefined],
    ]);
  });
});

describe('who may hold in the round (#55, X1)', () => {
  it('is chosen in „Neue Runde“ and kept without a choice', () => {
    const ctx = setup();
    runAction(ctx, 'u_Ada', {
      type: 'reset',
      rewards: { achievements: true, daily: true },
      guilds: true,
      allies: 1,
    });
    expect(roundRules(ctx).allies).toBe(1);
    expect(ctx.admin.universe().roundAllies).toBe(1);
    expect(roundRules(ctx).heldSpy).toBe(2);
    runAction(ctx, 'u_Ada', {
      type: 'reset',
      rewards: { achievements: true, daily: true },
    });
    expect(roundRules(ctx).allies).toBe(1);
  });
  it('refuses a value that is no choice', () => {
    for (const allies of [0, 4, 'x', null]) {
      const ctx = setup();
      expect(() =>
        runAction(ctx, 'u_Ada', {
          type: 'reset',
          rewards: { achievements: true, daily: true },
          allies,
        }),
      ).toThrow('Bitte auswählen, wer in der neuen Runde halten darf.');
      expect(roundRules(ctx).allies).toBe(3);
    }
  });
  it('sets the level of the spy report in „Neue Runde“ and live (X1)', () => {
    const ctx = setup();
    const reset = (heldSpy: unknown) =>
      runAction(ctx, 'u_Ada', {
        type: 'reset',
        rewards: { achievements: true, daily: true },
        heldSpy,
      });
    reset(5);
    expect(roundRules(ctx).heldSpy).toBe(5);
    reset(undefined);
    expect(roundRules(ctx).heldSpy).toBe(5);
    for (const bad of [-1, 31, 1.5, 'x'])
      expect(() => reset(bad)).toThrow(
        'Bitte für „Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“ eine ganze Zahl von 0 bis 30 angeben.',
      );
    runAction(ctx, 'u_Ada', {
      type: 'settings',
      settings: { ...ctx.admin.universe(), roundHeldSpy: 0 },
    });
    expect(roundRules(ctx).heldSpy).toBe(0);
  });
  it('is changed live in the universe settings', () => {
    const ctx = setup();
    runAction(ctx, 'u_Ada', {
      type: 'settings',
      settings: { ...ctx.admin.universe(), roundAllies: 2 },
    });
    expect(roundRules(ctx).allies).toBe(2);
    expect(() =>
      runAction(ctx, 'u_Ada', {
        type: 'settings',
        settings: { ...ctx.admin.universe(), roundAllies: 4 },
      }),
    ).toThrow('Halten erlaubt für');
  });
});
