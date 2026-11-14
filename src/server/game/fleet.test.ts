import { describe, expect, it } from 'vitest';
import { fieldsOf } from '../../core/fields.ts';
import { settle } from '../../core/settle.ts';
import { type TestCtx, addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { recall, send } from './fleet-actions.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { stateFor } from './state.ts';

function setup() {
  const ctx = testCtx();
  const a = addUser(ctx, 'Anna');
  const b = addUser(ctx, 'Bert');
  addPlanet(ctx, a.id, {
    g: 1,
    s: 1,
    p: 5,
    ships: { lf: 10, sc: 2, probe: 3 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  // Bert has enough points (metal mine 15) not to be under noob protection.
  addPlanet(ctx, b.id, { g: 1, s: 2, p: 6, b: { metal: 15 } });
  return { ctx, a, b };
}

const go = (over = {}) => ({
  mission: 'attack',
  ships: { lf: 2 },
  to: { g: 1, s: 2, p: 6 },
  pct: 10,
  cargo: {},
  ...over,
});

describe('sending fleets', () => {
  it('ignores ships asked for with 0 or not on the planet, satellites too (#46)', () => {
    const { ctx, a } = setup();
    expect(() => send(ctx, a, go({ ships: { sat: 2 } }))).toThrow(
      'Keine Schiffe ausgewählt.',
    );
    send(ctx, a, go({ ships: { lf: 2, sc: 0, sat: 0, bs: 4 } }));
    expect(ctx.fleets.all()[0]!.ships).toEqual({ lf: 2 });
  });
  it('takes ships, fuel and cargo and starts the flight', () => {
    const { ctx, a } = setup();
    expect(
      send(
        ctx,
        a,
        go({
          mission: 'transport',
          ships: { sc: 1 },
          cargo: { m: 1000, c: 2000, d: 500 },
        }),
      ),
    ).toBe('Flotte unterwegs nach [1:2:6].');
    const p = ctx.planets.home(a.id)!;
    expect(p.ships.sc).toBe(1);
    expect(p.res).toEqual({ m: 49000, c: 38000, d: 30000 - 500 - 4 });
    const f = ctx.fleets.all()[0]!;
    expect(f).toMatchObject({
      owner: a.id,
      from: 'p1_1_5',
      to: 'p1_2_6',
      mission: 'transport',
      ships: { sc: 1 },
      cargo: { m: 1000, c: 2000, d: 500 },
      state: 'out',
      recalled: false,
    });
    expect(f.arr - f.dep).toBe(
      Math.round(((3500 * Math.sqrt(27950 / 5000) + 10) / 5) * 1000),
    );
    expect(f.ret - f.dep).toBe(2 * (f.arr - f.dep));
  });
  it('limits ships and cargo to what is there', () => {
    const { ctx, a } = setup();
    send(ctx, a, go({ ships: { lf: 999, nope: 4, sc: -2, probe: 3 } }));
    expect(ctx.fleets.all()[0]!.ships).toEqual({ lf: 10, probe: 3 });
    // The cargo is limited to the stock first: 50,000 metal do not fit into 500.
    a.research = { computer: 1 };
    ctx.players.save(a);
    expect(() =>
      send(
        ctx,
        a,
        go({ mission: 'transport', ships: { sc: 1 }, cargo: { m: 1e9 } }),
      ),
    ).toThrow('Laderaum');
    expect(
      send(
        ctx,
        a,
        go({
          mission: 'transport',
          ships: { sc: 2 },
          cargo: { m: 3000, c: 3000, d: 1000 },
        }),
      ),
    ).toContain('unterwegs');
  });
  it('refuses wrong orders', () => {
    const { ctx, a, b } = setup();
    expect(() => send(ctx, a, go({ mission: 'unknown' }))).toThrow(
      'Unbekannter Auftrag.',
    );
    expect(() => send(ctx, a, go({ ships: {} }))).toThrow(
      'Keine Schiffe ausgewählt.',
    );
    expect(() => send(ctx, a, go({ ships: null }))).toThrow(
      'Keine Schiffe ausgewählt.',
    );
    expect(() => send(ctx, a, go({ to: { g: 2, s: 2, p: 2 } }))).toThrow(
      'keinen Planeten',
    );
    expect(() => send(ctx, a, go({ to: null }))).toThrow('keinen Planeten');
    expect(() => send(ctx, a, go({ to: { g: 1, s: 1, p: 5 } }))).toThrow(
      'dein eigener Planet',
    );
    expect(() =>
      send(ctx, a, go({ mission: 'spy', ships: { lf: 1, probe: 1 } })),
    ).toThrow('nur mit Spähschädeln');
    expect(() =>
      send(
        ctx,
        a,
        go({ mission: 'transport', ships: { lf: 1 }, cargo: { m: 51 } }),
      ),
    ).toThrow('Laderaum');
    const home = ctx.planets.home(a.id)!;
    home.ships.sat = 4;
    ctx.planets.save(home);
    expect(() => send(ctx, a, go({ ships: { lf: 1, sat: 2 } }))).toThrow(
      'Sonnenreliquiare können nicht fliegen.',
    );
    expect(ctx.planets.home(a.id)!.ships).toMatchObject({
      lf: 10,
      sat: 4,
    });
    expect(ctx.fleets.all()).toEqual([]);
    expect(() => send(ctx, a, go({ ships: { toString: 3 } }))).toThrow(
      'Keine Schiffe ausgewählt.',
    );
    addPlanet(ctx, a.id, { g: 1, s: 3, p: 3, created: 2e6 });
    expect(() => send(ctx, a, go({ to: { g: 1, s: 3, p: 3 } }))).toThrow(
      'Eigene Planeten',
    );
    void b;
  });
  it('needs deuterium for fuel and cargo', () => {
    const { ctx, a } = setup();
    const p = ctx.planets.home(a.id)!;
    p.res.d = 5;
    ctx.planets.save(p);
    expect(() => send(ctx, a, go())).toThrow('Nicht genug Promethium');
  });
  it('respects the fleet slots', () => {
    const { ctx, a } = setup();
    send(ctx, a, go());
    expect(() => send(ctx, a, go())).toThrow('Alle Flottenslots belegt.');
    a.research = { computer: 1 };
    ctx.players.save(a);
    expect(send(ctx, a, go())).toContain('unterwegs');
  });
  it('protects small players but allows transports to them', () => {
    const { ctx, a, b } = setup();
    const p = ctx.planets.home(a.id)!;
    p.b = { metal: 30 };
    ctx.planets.save(p);
    expect(() => send(ctx, a, go())).toThrow('Noobschutz');
    expect(send(ctx, a, go({ mission: 'transport' }))).toContain('unterwegs');
    void b;
  });
});

describe('recall', () => {
  it('turns the fleet around; the way back takes as long as the way out so far', () => {
    const { ctx, a } = setup();
    send(ctx, a, go());
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t += 1000;
    expect(recall(ctx, a, { id: f.id })).toBe('Flotte zurückgerufen.');
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      ret: ctx.now() + 1000,
      recalled: true,
    });
    expect(() => recall(ctx, a, { id: f.id })).toThrow(
      'Rückruf nicht mehr möglich.',
    );
  });
  it('is refused for foreign, unknown or arrived fleets', () => {
    const { ctx, a, b } = setup();
    send(ctx, a, go());
    const f = ctx.fleets.all()[0]!;
    expect(() => recall(ctx, b, { id: f.id })).toThrow('Rückruf');
    expect(() => recall(ctx, a, { id: 'x' })).toThrow('Rückruf');
    ctx.clock.t = f.arr;
    expect(() => recall(ctx, a, { id: f.id })).toThrow('Rückruf');
  });
});

describe('colonization', () => {
  const to = { g: 1, s: 1, p: 6 };
  const mission = go({
    mission: 'colonize',
    ships: { colony: 1, sc: 1 },
    to,
    cargo: { m: 400 },
  });
  const colonyId = 'p1_1_6';

  it('builds a colony ship, settles a new world and returns its escort', () => {
    const { ctx, a, b } = setup();
    const home = ctx.planets.home(a.id)!;
    home.b.yard = 4;
    ctx.planets.save(home);
    expect(() =>
      runAction(ctx, a.id, { type: 'order', key: 'colony', n: 1 }),
    ).toThrow('Das Wissen ist noch verschlossen.');
    a.research.impulse = 3;
    ctx.players.save(a);
    runAction(ctx, a.id, { type: 'order', key: 'colony', n: 1 });
    ctx.clock.t += ctx.planets.get(home.id)!.sq[0]!.unit;
    runAction(ctx, a.id, { ...mission, type: 'send' });
    const fleet = ctx.fleets.all()[0]!;
    expect(fleet.ships).toEqual({ colony: 1, sc: 1 });
    ctx.clock.t = fleet.arr;
    tick(ctx);
    expect(ctx.planets.get(colonyId)).toMatchObject({
      owner: a.id,
      res: { m: 400, c: 0, d: 0 },
      created: fleet.arr,
      unlimited: false,
    });
    // Fields at random in the range of position 6: 146 to 242 (#51).
    const fields = fieldsOf(ctx.planets.get(colonyId)!.diameter);
    expect(fields).toBeGreaterThanOrEqual(146);
    expect(fields).toBeLessThanOrEqual(242);
    expect(ctx.fleets.get(fleet.id)).toMatchObject({
      state: 'back',
      ships: { sc: 1 },
      cargo: { m: 0, c: 0, d: 0 },
    });
    expect(stateFor(ctx, a, colonyId).planet).toMatchObject({ id: colonyId });
    expect(stateFor(ctx, b, colonyId).planet).toMatchObject({ owner: b.id });
    // The labs of all own planets come along for the research network (#49).
    expect(stateFor(ctx, a, colonyId).labs).toEqual([
      { id: home.id, lab: 0, upgrading: false },
      { id: colonyId, lab: 0, upgrading: false },
    ]);
    expect(stateFor(ctx, b, colonyId).labs).toEqual([
      { id: ctx.planets.home(b.id)!.id, lab: 0, upgrading: false },
    ]);
    expect(() =>
      runAction(ctx, b.id, {
        type: 'rename',
        planet: colonyId,
        name: 'wrong owner',
      }),
    ).toThrow('Zugriff');
    runAction(ctx, a.id, { type: 'rename', planet: colonyId, name: 'Nova' });
    expect(ctx.planets.get(colonyId)?.name).toBe('Nova');
    expect(ctx.planets.home(a.id)?.id).toBe(home.id);
    ctx.clock.t = fleet.ret;
    tick(ctx);
    expect(ctx.planets.get(home.id)?.ships).toMatchObject({ sc: 2 });
    expect(ctx.planets.get(home.id)?.ships.colony).toBeUndefined();
  });

  it('rejects invalid launches and returns ships and cargo if another fleet arrives first', () => {
    const { ctx, a, b } = setup();
    expect(() => send(ctx, a, mission)).toThrow('Kolonistenarche');
    const home = ctx.planets.home(a.id)!;
    home.ships.colony = 1;
    ctx.planets.save(home);
    const other = ctx.planets.home(b.id)!;
    other.ships.colony = 1;
    ctx.planets.save(other);
    expect(() => send(ctx, a, { ...mission, to: other })).toThrow('besetzt');
    send(ctx, a, mission);
    send(ctx, b, mission);
    const [first, second] = ctx.fleets.all().sort((x, y) => x.arr - y.arr);
    expect(first?.owner).toBe(a.id);
    ctx.clock.t = second!.arr;
    tick(ctx);
    expect(ctx.planets.get(colonyId)?.owner).toBe(a.id);
    expect(ctx.fleets.get(second!.id)).toMatchObject({
      state: 'back',
      ships: { colony: 1 },
      cargo: { m: 400 },
    });
    ctx.clock.t = second!.ret;
    tick(ctx);
    expect(ctx.planets.get(other.id)?.ships.colony).toBe(1);
    expect(ctx.fleets.get(second!.id)).toBeNull();
  });
});

describe('deploy (#129)', () => {
  const colonyAt = { g: 1, s: 1, p: 7 };
  const colonyId = 'p1_1_7';
  const order = (over = {}) =>
    go({
      mission: 'deploy',
      ships: { lf: 2, sc: 1 },
      to: colonyAt,
      cargo: { m: 1000, c: 500, d: 200 },
      ...over,
    });

  function withColony() {
    const s = setup();
    addPlanet(s.ctx, s.a.id, {
      ...colonyAt,
      name: 'Kolonie',
      created: 2e6,
      res: { m: 10, c: 20, d: 30 },
    });
    return s;
  }

  /** The stock of a planet at time t without any fleet. */
  const stockAt = (ctx: TestCtx, id: string, t: number) =>
    settle(ctx.planets.get(id)!, t, ctx.admin.universe(), {
      research: {},
      rq: null,
    }).res;

  it('flies only to another own planet', () => {
    const { ctx, a } = withColony();
    expect(() => send(ctx, a, order({ to: { g: 1, s: 2, p: 6 } }))).toThrow(
      'Verlegung nur zu einem eigenen Planeten.',
    );
    expect(() => send(ctx, a, order({ to: { g: 1, s: 1, p: 5 } }))).toThrow(
      'Das ist dein eigener Planet.',
    );
    expect(() => send(ctx, a, order({ to: { g: 1, s: 1, p: 9 } }))).toThrow(
      'An dieser Position gibt es keinen Planeten.',
    );
    expect(() => send(ctx, a, order({ cargo: { m: 50000 } }))).toThrow(
      'Nicht genug Laderaum.',
    );
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('is not stopped by the noob protection of the attack rules', () => {
    const { ctx, a } = withColony();
    const home = ctx.planets.home(a.id)!;
    home.b = { metal: 30 };
    ctx.planets.save(home);
    expect(send(ctx, a, order())).toBe('Flotte unterwegs nach [1:1:7].');
  });

  it('keeps ships and cargo at the target with half the fuel, and ends the flight', () => {
    const { ctx, a } = withColony();
    // 1,010 away at full speed: 2 lf and 1 sc burn 7, half rounded down is 3.
    expect(runAction(ctx, a.id, { ...order(), type: 'send' })).toBe(
      'Flotte unterwegs nach [1:1:7].',
    );
    const f = ctx.fleets.all()[0]!;
    expect(f).toMatchObject({
      mission: 'deploy',
      to: colonyId,
      ships: { lf: 2, sc: 1 },
      cargo: { m: 1000, c: 500, d: 200 },
      fuel: 7,
      state: 'out',
    });
    const home = ctx.planets.home(a.id)!;
    expect(home.ships).toEqual({ lf: 8, sc: 1, probe: 3 });
    expect(home.res).toEqual({ m: 49000, c: 39500, d: 30000 - 200 - 7 });
    // The flight takes a fleet slot until it arrives.
    expect(() => send(ctx, a, order())).toThrow('Alle Flottenslots belegt.');
    const before = stockAt(ctx, colonyId, f.arr);
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.fleets.all()).toEqual([]);
    const colony = ctx.planets.get(colonyId)!;
    expect(colony.ships).toEqual({ lf: 2, sc: 1 });
    expect(colony.res).toEqual({
      m: before.m + 1000,
      c: before.c + 500,
      d: before.d + 200 + 3,
    });
    expect(ctx.reports.ofPlayer(a.id)[0]).toMatchObject({
      title: 'Verlegung erreicht [1:1:7]',
      text: 'Deine Flotte bleibt auf Kolonie [1:1:7] und liefert Adamant 1.000 · Psikristall 500 · Promethium 203, davon 3 übriger Treibstoff.',
    });
    // Nothing comes back home, and the slot is free again.
    ctx.clock.t = f.ret;
    tick(ctx);
    expect(ctx.planets.home(a.id)!.ships).toEqual({
      lf: 8,
      sc: 1,
      probe: 3,
    });
    expect(send(ctx, a, order({ ships: { lf: 1 }, cargo: {} }))).toContain(
      'unterwegs',
    );
  });

  it('a recall brings ships and cargo back to the start planet; the fuel stays burnt', () => {
    const { ctx, a } = withColony();
    send(ctx, a, order());
    const f = ctx.fleets.all()[0]!;
    const colony = ctx.planets.get(colonyId)!;
    ctx.clock.t += 1000;
    expect(recall(ctx, a, { id: f.id })).toBe('Flotte zurückgerufen.');
    const ret = ctx.fleets.get(f.id)!.ret;
    const before = stockAt(ctx, 'p1_1_5', ret);
    ctx.clock.t = ret;
    tick(ctx);
    expect(ctx.fleets.all()).toEqual([]);
    const home = ctx.planets.home(a.id)!;
    expect(home.ships).toEqual({ lf: 10, sc: 2, probe: 3 });
    expect(home.res).toEqual({
      m: before.m + 1000,
      c: before.c + 500,
      d: before.d + 200,
    });
    expect(ctx.planets.get(colonyId)).toEqual(colony);
    expect(ctx.reports.ofPlayer(a.id)[0]).toMatchObject({
      title: 'Rückkehr zu Planet u_Anna [1:1:5]',
      text: 'Deine Flotte ist zurück und bringt Adamant 1.000 · Psikristall 500 · Promethium 200 mit.',
    });
  });
});

describe('Trümmerfelder in the state (#45)', () => {
  it('shows every player every field, with its place and amounts', () => {
    const { ctx, a, b } = setup();
    ctx.debris.add({ g: 1, s: 2, p: 6 }, { m: 1800, c: 600.5 });
    ctx.debris.add({ g: 2, s: 1, p: 1 }, { m: 0, c: 300 });
    const fields = [
      { id: 'd1_2_6', g: 1, s: 2, p: 6, m: 1800, c: 600.5 },
      { id: 'd2_1_1', g: 2, s: 1, p: 1, m: 0, c: 300 },
    ];
    expect(stateFor(ctx, a).debris).toEqual(fields);
    expect(stateFor(ctx, b).debris).toEqual(fields);
  });

  it('shows a Bergung to its owner only, not to the player at the position', () => {
    const { ctx, a, b } = setup();
    ctx.debris.add({ g: 1, s: 2, p: 6 }, { m: 1800, c: 600 });
    const home = ctx.planets.home(a.id)!;
    ctx.planets.save({ ...home, ships: { recycler: 1 } });
    send(ctx, a, {
      planet: home.id,
      ships: { recycler: 1 },
      to: { g: 1, s: 2, p: 6 },
      mission: 'harvest',
      pct: 10,
    });
    expect(stateFor(ctx, b).fleets).toEqual([]);
    expect(stateFor(ctx, a).fleets).toMatchObject([{ to: 'd1_2_6' }]);
  });
});
