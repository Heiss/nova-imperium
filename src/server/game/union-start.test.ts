// The planned start of a leader's fleet (#478, owner, 2026-11-28): a union
// whose arrival X the fleet cannot reach at once even at 10 % starts it by
// itself at X minus its flight at the chosen step. Until then the ships stay
// on the planet (held back from other orders, still there for a battle) and
// nothing is paid; the start takes what is left and pays the fuel. No ship,
// too little Promethium, a lost planet or a refused target dissolve the
// union; the leader can abort it. The slot and the vacation count it.
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { distance, fleetSpeed, flightMs, fuelFor } from '../../core/flight.ts';
import type { Fleet } from '../../core/types.ts';
import { UNION_OFF_REFUSAL } from '../../core/union.ts';
import {
  type TestCtx,
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { pickedShips, send } from './fleet-actions.ts';
import { stateFor } from './state.ts';
import { LEAD_NOT_STARTED, NOT_STARTED } from './union-start.ts';
import { RECALLED, reservedAt, unionOf, unionsFor } from './union.ts';

const ANNA = { g: 1, s: 1, p: 5 };
const BERT = { g: 1, s: 2, p: 6 };
const DIRK = { g: 1, s: 4, p: 8 };
const DIRK_ID = 'p1_4_8';
const HOUR = 3_600_000;

const user = (ctx: TestCtx, name: string) => ctx.players.get(`u_${name}`)!;

/** Anna and Bert share a guild; Dirk is the target. */
function setup(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { research: { weapons: 3 } });
  addUser(ctx, 'Bert');
  addUser(ctx, 'Dirk');
  addPlanet(ctx, 'u_Anna', {
    ...ANNA,
    name: 'Alpha',
    ships: { lf: 20, bs: 10 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  addPlanet(ctx, 'u_Bert', {
    ...BERT,
    name: 'Beta',
    ships: { lf: 20, bs: 10 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  addPlanet(ctx, 'u_Dirk', {
    ...DIRK,
    name: 'Delta',
    ships: { lf: 20, bs: 10 },
    res: { m: 10000, c: 6000, d: 2000 },
  });
  ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Anna');
  ctx.guilds.apply('u_Bert', 'g1');
  ctx.guilds.accept('u_Bert');
  return ctx;
}

const go = (planet: string, ships: Record<string, number>, over = {}) => ({
  planet,
  mission: 'attack',
  ships,
  to: DIRK,
  pct: 10,
  cargo: {},
  ...over,
});

const flightOf = (
  ctx: TestCtx,
  uid: string,
  from: typeof ANNA,
  ships: Record<string, number>,
  pct: number,
): number =>
  flightMs(
    distance(from, DIRK),
    fleetSpeed(ships, { research: ctx.players.get(uid)!.research }),
    pct,
    ctx.admin.universe(),
  );

const SHIPS = { bs: 4 };
const STEP = 5;

/**
 * Anna plans a union on Dirk arriving an hour after her fleet could at 10 %,
 * at the step 5: the union's ID, its X and the planned start.
 */
function planned(ctx: TestCtx, ships: Record<string, number> = SHIPS) {
  const arr = ctx.now() + flightOf(ctx, 'u_Anna', ANNA, ships, 1) + HOUR;
  const message = send(
    ctx,
    user(ctx, 'Anna'),
    go('p1_1_5', ships, { plan: arr, pct: STEP }),
  );
  const id = ctx.unions.ledBy('u_Anna').at(-1)!;
  const start = arr - flightOf(ctx, 'u_Anna', ANNA, ships, STEP);
  return { id, arr, start, message };
}

/**
 * Bert joins the union `id` with one Schlachtschiff, after Anna's
 * invitation, once X is within his window (a join starts at once, #466).
 */
function bertJoins(ctx: TestCtx, id: string) {
  const arr = ctx.unions.get(id)!.arr;
  ctx.clock.t = Math.max(
    ctx.now(),
    arr - flightOf(ctx, 'u_Bert', BERT, { bs: 1 }, 1),
  );
  // Before the leader's start, so the union waits for it.
  expect(ctx.now()).toBeLessThan(ctx.unions.get(id)!.start!.at);
  runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
  runAction(ctx, 'u_Bert', {
    type: 'send',
    ...go('p1_2_6', { bs: 1 }, { union: id }),
  });
  return ctx.fleets.ofUnion(id).find((f) => f.owner === 'u_Bert')!;
}

const refused = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return 'not refused';
};

const alpha = (ctx: TestCtx) => ctx.planets.get('p1_1_5')!;

/** The newest report of `uid`. */
const newest = (ctx: TestCtx, uid: string) =>
  [...ctx.reports.ofPlayer(uid)].sort((a, b) => b.time - a.time)[0]!;

describe('planning a union whose arrival the leader’s fleet cannot reach at once (#478)', () => {
  it('plans its start at X minus its flight at the chosen step; nothing leaves the planet, nothing is paid', () => {
    const ctx = setup();
    const before = alpha(ctx);
    const { id, arr, start, message } = planned(ctx);
    expect(ctx.fleets.all()).toEqual([]);
    expect(ctx.unions.get(id)).toEqual({
      id,
      leader: 'u_Anna',
      lead: id,
      target: DIRK_ID,
      toC: DIRK,
      arr,
      start: { at: start, from: 'p1_1_5', ships: SHIPS, pct: STEP },
    });
    expect(start).toBeGreaterThan(ctx.now());
    expect(alpha(ctx).ships).toEqual(before.ships);
    expect(alpha(ctx).res.d).toBe(before.res.d);
    expect(message).toMatch(
      /^Sturmangriff geplant: Start am .+, Ankunft am .+\.$/,
    );
    // The union is alive: Bert is invited and joins, arriving at X.
    expect(unionOf(ctx, id)).not.toBeNull();
    expect(bertJoins(ctx, id)).toMatchObject({ arr, union: id });
    expect(unionsFor(ctx, 'u_Bert')).toMatchObject([{ id, start, arr }]);
    expect(
      (stateFor(ctx, user(ctx, 'Anna')) as { unions: unknown[] }).unions,
    ).toMatchObject([{ id, start }]);
  });

  it('starts at once as before when X lies in the window from 10 % to 100 %', () => {
    const ctx = setup();
    const arr = ctx.now() + flightOf(ctx, 'u_Anna', ANNA, SHIPS, 1);
    send(ctx, user(ctx, 'Anna'), go('p1_1_5', SHIPS, { plan: arr, pct: STEP }));
    const [f] = ctx.fleets.all();
    expect(f).toMatchObject({ arr, dep: ctx.now(), union: f!.id });
    expect(ctx.unions.get(f!.id)).not.toHaveProperty('start');
  });

  it('holds the planned ships back from other orders and counts a fleet slot; a battle at home still finds them', () => {
    const ctx = setup();
    const { id } = planned(ctx, { bs: 10 });
    expect(reservedAt(ctx, 'p1_1_5')).toEqual({ bs: 10 });
    expect(pickedShips(alpha(ctx), { bs: 10, lf: 3 }, { bs: 10 })).toEqual({
      lf: 3,
    });
    expect(pickedShips(alpha(ctx), { bs: 10 })).toEqual({ bs: 10 });
    expect(
      refused(() => send(ctx, user(ctx, 'Anna'), go('p1_1_5', { bs: 1 }))),
    ).toContain('Schiff');
    expect(alpha(ctx).ships.bs).toBe(10);
    // Anna has one slot (no research): the plan takes it.
    expect(
      refused(() => send(ctx, user(ctx, 'Anna'), go('p1_1_5', { lf: 1 }))),
    ).toMatch(/Flotten|Slot/);
    expect(ctx.unions.get(id)!.start).toBeDefined();
  });

  it('refuses cargo, a plan while the switch is off, and the vacation while it is planned', () => {
    const ctx = setup();
    const arr = ctx.now() + flightOf(ctx, 'u_Anna', ANNA, SHIPS, 1) + HOUR;
    expect(
      refused(() =>
        send(
          ctx,
          user(ctx, 'Anna'),
          go('p1_1_5', SHIPS, { plan: arr, pct: STEP, cargo: { m: 1 } }),
        ),
      ),
    ).toBe('Eine Flotte, die später startet, nimmt keine Ladung mit.');
    planned(ctx);
    expect(
      refused(() => runAction(ctx, 'u_Anna', { type: 'startVacation' })),
    ).toBe(
      'Der Urlaubsmodus kann nicht aktiviert werden, solange eigene Flotten unterwegs sind.',
    );
    ctx.admin.putSettings([['roundUnionOn', 0]]);
    const later = setup();
    later.admin.putSettings([['roundUnionOn', 0]]);
    expect(refused(() => planned(later))).toBe(UNION_OFF_REFUSAL);
    expect(later.unions.ledBy('u_Anna')).toEqual([]);
  });
});

describe('the start of a planned fleet (#478)', () => {
  it('starts by itself at its time with the planned ships, pays the fuel then and arrives at X with the union', () => {
    const ctx = setup();
    const { id, arr, start } = planned(ctx);
    const bert = bertJoins(ctx, id);
    const d = alpha(ctx).res.d;
    ctx.clock.t = start - 1;
    tick(ctx);
    expect(ctx.fleets.get(id)).toBeNull();
    ctx.clock.t = start;
    tick(ctx);
    const fuel = fuelFor(SHIPS, distance(ANNA, DIRK), STEP);
    expect(ctx.fleets.get(id)).toMatchObject({
      owner: 'u_Anna',
      ships: SHIPS,
      dep: start,
      arr,
      ret: arr + (arr - start),
      state: 'out',
      fuel,
      union: id,
      mission: 'attack',
    });
    expect(alpha(ctx).ships.bs).toBe(6);
    expect(alpha(ctx).res.d).toBeCloseTo(d - fuel, 0);
    expect(ctx.unions.get(id)).not.toHaveProperty('start');
    expect(reservedAt(ctx, 'p1_1_5')).toEqual({});
    expect(unionOf(ctx, id)!.fleets.map((f) => f.id)).toEqual([id, bert.id]);
    // At X both fight as one union.
    ctx.clock.t = arr;
    tick(ctx);
    const battle = ctx.reports
      .ofPlayer('u_Dirk')
      .find((r) => r.type === 'battle')!;
    expect(battle).toMatchObject({ attackers: [{ name: 'Bert' }] });
  });

  it('starts late at its own time when the tick comes later, and still arrives at X', () => {
    const ctx = setup();
    const { id, arr, start } = planned(ctx);
    ctx.clock.t = start + 1500;
    tick(ctx);
    expect(ctx.fleets.get(id)).toMatchObject({ dep: start, arr });
  });

  it('takes only what is left on the planet', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    ctx.planets.save({ ...alpha(ctx), ships: { lf: 20, bs: 3 } });
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.fleets.get(id)!.ships).toEqual({ bs: 3 });
    expect(alpha(ctx).ships.bs ?? 0).toBe(0);
    expect(alpha(ctx).ships.lf).toBe(20);
  });

  it('dissolves the union when no planned ship is left: the joined fleets turn back, each owner gets a report', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    const bert = bertJoins(ctx, id);
    ctx.planets.save({ ...alpha(ctx), ships: { lf: 20 } });
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.fleets.get(id)).toBeNull();
    expect(ctx.unions.get(id)).toBeNull();
    expect(ctx.fleets.get(bert.id)).toMatchObject({
      state: 'back',
      recalled: true,
      ret: start + (start - bert.dep),
    });
    expect(ctx.fleets.get(bert.id)).not.toHaveProperty('union');
    expect(newest(ctx, 'u_Bert')).toMatchObject({
      type: 'info',
      title: 'Angriffsverband aufgelöst [1:4:8]',
      text: LEAD_NOT_STARTED('[1:4:8]'),
    });
    expect(newest(ctx, 'u_Anna')).toMatchObject({
      type: 'info',
      time: start,
      title: NOT_STARTED.title('[1:4:8]'),
      text: NOT_STARTED.ships('[1:4:8]'),
    });
  });

  it('dissolves the union when the Promethium is short, naming what is needed and what is there', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    ctx.planets.save({ ...alpha(ctx), res: { m: 0, c: 0, d: 1 } });
    ctx.clock.t = start;
    tick(ctx);
    const fuel = fuelFor(SHIPS, distance(ANNA, DIRK), STEP);
    expect(ctx.unions.get(id)).toBeNull();
    expect(alpha(ctx).ships.bs).toBe(10);
    expect(newest(ctx, 'u_Anna').text).toBe(
      NOT_STARTED.fuel('[1:4:8]', fuel, alpha(ctx).res.d),
    );
    expect(NOT_STARTED.fuel('[1:4:8]', 12345, 7.9)).toContain(
      'nötig 12.345, vorhanden 7',
    );
  });

  it('dissolves the union when the planet is no longer the leader’s, or the target refuses the attack', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    ctx.planets.save({ ...alpha(ctx), owner: 'u_Bert' });
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.unions.get(id)).toBeNull();
    expect(newest(ctx, 'u_Anna').text).toBe(NOT_STARTED.planet('[1:4:8]'));
    const other = setup();
    const plan = planned(other);
    other.players.save({ ...user(other, 'Dirk'), vacation: other.now() });
    other.clock.t = plan.start;
    tick(other);
    expect(other.unions.get(plan.id)).toBeNull();
    expect(other.fleets.get(plan.id)).toBeNull();
    const text = newest(other, 'u_Anna').text as string;
    expect(
      text.startsWith(
        'Dein geplanter Sturmangriff auf [1:4:8] ist nicht gestartet: ',
      ),
    ).toBe(true);
    expect(text).toMatch(/Urlaubsmodus/);
  });

  it('still starts while the switch is off', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    ctx.admin.putSettings([['roundUnionOn', 0]]);
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.fleets.get(id)).toMatchObject({ state: 'out', union: id });
  });
});

describe('the leader aborts a planned start (#478)', () => {
  it('dissolves the union, as his recall does; nobody else may', () => {
    const ctx = setup();
    const { id } = planned(ctx);
    const bert = bertJoins(ctx, id);
    expect(
      refused(() => runAction(ctx, 'u_Bert', { type: 'cancelPlan', id })),
    ).toBe('Diesen geplanten Start gibt es nicht mehr.');
    expect(runAction(ctx, 'u_Anna', { type: 'cancelPlan', id })).toBe(
      'Geplanter Start abgebrochen. Der Angriffsverband ist aufgelöst.',
    );
    expect(ctx.unions.get(id)).toBeNull();
    expect(ctx.fleets.get(bert.id)).toMatchObject({ state: 'back' });
    expect(newest(ctx, 'u_Bert').text).toBe(RECALLED('[1:4:8]'));
    expect(reservedAt(ctx, 'p1_1_5')).toEqual({});
    expect(
      refused(() => runAction(ctx, 'u_Anna', { type: 'cancelPlan', id })),
    ).toBe('Diesen geplanten Start gibt es nicht mehr.');
  });
});

/** A fleet of Anna's that comes home to Alpha at `ret` with `ships`. */
function homecoming(
  ctx: TestCtx,
  id: string,
  ret: number,
  ships: Record<string, number> = { bs: 2 },
) {
  const f: Fleet = {
    id,
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: ANNA,
    to: 'p1_2_6',
    toC: BERT,
    mission: 'transport',
    ships,
    cargo: { m: 0, c: 0, d: 0 },
    dep: ret - 2000,
    arr: ret - 1000,
    ret,
    state: 'back',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  return f;
}

/** The audit entries of `action`, their detail read. */
const audit = (ctx: TestCtx, action: string) =>
  (
    ctx.store.db
      .prepare(
        'SELECT actor, target, detail FROM audit_events WHERE action = ? ORDER BY id',
      )
      .all(action) as { actor: string; target: string; detail: string }[]
  ).map((r) => ({ ...r, detail: JSON.parse(r.detail) as unknown }));

describe('the planned start in the tick (#478)', () => {
  it('comes in the order of time with the fleets: a fleet home before the start brings its ships, one after it comes later in the same tick', () => {
    const ctx = setup();
    const { id, start } = planned(ctx, { bs: 10 });
    ctx.planets.save({ ...alpha(ctx), ships: { lf: 20, bs: 8 } });
    homecoming(ctx, 'early', start - 10);
    homecoming(ctx, 'late', start + 10, { lf: 1 });
    ctx.clock.t = start + 20;
    expect(tick(ctx)).toBe(3);
    expect(ctx.fleets.get(id)!.ships).toEqual({ bs: 10 });
    expect(ctx.fleets.get('late')).toBeNull();
    expect(alpha(ctx).ships.lf).toBe(21);
  });

  it('leaves the start for the next tick while the database writer is busy, and nothing after it', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    homecoming(ctx, 'late', start + 10);
    ctx.clock.t = start + 20;
    const tx = () => {
      throw new Database.SqliteError('database is locked', 'SQLITE_BUSY');
    };
    tick({ ...ctx, tx });
    expect(ctx.unions.get(id)!.start).toBeDefined();
    expect(ctx.fleets.get('late')!.state).toBe('back');
    tick(ctx);
    expect(ctx.fleets.get(id)).toMatchObject({ state: 'out' });
    expect(ctx.fleets.get('late')).toBeNull();
  });

  it('drops a start that fails otherwise, logs it and goes on with the fleets', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    homecoming(ctx, 'late', start + 10);
    ctx.clock.t = start + 20;
    const log = vi.fn();
    const unions = Object.create(ctx.unions, {
      save: {
        value: () => {
          throw new Error('kaputt');
        },
      },
    });
    tick({ ...ctx, unions }, log);
    expect(log).toHaveBeenCalledWith(
      `Planned start ${id} failed and was removed`,
      expect.objectContaining({ message: 'kaputt' }),
    );
    expect(ctx.unions.get(id)).toBeNull();
    expect(ctx.fleets.get('late')).toBeNull();
  });

  it('skips a start that is gone or not due any more by the time it runs', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    const row = ctx.unions.get(id)!;
    const log = vi.fn();
    // Listed as due, but the row is gone (dissolved by an earlier event).
    const gone = Object.create(ctx.unions, {
      dueStarts: { value: () => [row] },
      get: { value: () => null },
    });
    tick({ ...ctx, unions: gone }, log);
    expect(log).not.toHaveBeenCalled();
    // Listed as due, but its start is later than now.
    const early = Object.create(ctx.unions, {
      dueStarts: { value: () => [row] },
    });
    ctx.clock.t = start - 1;
    tick({ ...ctx, unions: early }, log);
    expect(ctx.fleets.get(id)).toBeNull();
    expect(ctx.unions.get(id)!.start).toBeDefined();
    expect(log).not.toHaveBeenCalled();
  });

  it('rethrows what is no refusal of the target: the start is dropped and logged, not reported', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    ctx.clock.t = start;
    const log = vi.fn();
    const get = ctx.planets.get.bind(ctx.planets);
    const planets = Object.create(ctx.planets, {
      get: {
        value: (pid: string) => {
          if (pid === DIRK_ID) throw new Error('kaputt');
          return get(pid);
        },
      },
    });
    tick({ ...ctx, planets }, log);
    expect(log).toHaveBeenCalledTimes(1);
    expect(ctx.unions.get(id)).toBeNull();
    expect(
      ctx.reports
        .ofPlayer('u_Anna')
        .some((r) => String(r.text).includes('kaputt')),
    ).toBe(false);
  });
});

describe('the start of a planned fleet, in detail (#478)', () => {
  it('flies only kinds still there, sends no recall flag, tells the defender’s guild and writes the audit entry', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'DRK', 'Dirks Gilde', '', 'u_Dirk');
    const { id, arr, start } = planned(ctx, { bs: 4, lf: 2 });
    // The Lichte Jäger are gone by the start.
    ctx.planets.save({ ...alpha(ctx), ships: { bs: 10 } });
    ctx.clock.t = start;
    tick(ctx);
    const fleet = ctx.fleets.get(id)!;
    expect(fleet.ships).toEqual({ bs: 4 });
    expect(fleet.recalled).toBe(false);
    expect(ctx.guilds.chat('g2')).toMatchObject([
      { kind: 'attack', text: '[1:4:8]', attacker: 'u_Anna', arrival: arr },
    ]);
    expect(audit(ctx, 'plannedStart')).toEqual([
      {
        actor: 'u_Anna',
        target: 'u_Dirk',
        detail: {
          fleet: id,
          planet: DIRK_ID,
          origin: 'p1_1_5',
          start,
          due: arr,
        },
      },
    ]);
  });

  it('starts with the Promethium exactly enough, and attacks a moon too', () => {
    const ctx = setup();
    const fuel = fuelFor(SHIPS, distance(ANNA, DIRK), STEP);
    const { id, start } = planned(ctx);
    ctx.planets.save({ ...alpha(ctx), res: { m: 0, c: 0, d: fuel } });
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.fleets.get(id)).toMatchObject({ state: 'out' });
    expect(alpha(ctx).res.d).toBeCloseTo(0, 6);
  });

  it('dissolves the union when the planet is gone or the leader is unknown', () => {
    const ctx = setup();
    const { id, start } = planned(ctx);
    ctx.planets.delete('p1_1_5');
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.unions.get(id)).toBeNull();
    expect(newest(ctx, 'u_Anna').text).toBe(
      'Dein geplanter Sturmangriff auf [1:4:8] ist nicht gestartet: Der Planet des Starts gehört dir nicht mehr. Der Angriffsverband ist aufgelöst.',
    );
    const other = setup();
    const plan = planned(other);
    const players = Object.create(other.players, {
      get: {
        value: (uid: string) =>
          uid === 'u_Anna' ? null : other.store.repos.players.get(uid),
      },
    });
    other.clock.t = plan.start;
    tick({ ...other, players });
    expect(other.unions.get(plan.id)).toBeNull();
    expect(other.fleets.get(plan.id)).toBeNull();
  });

  it('reports to every member but the leader, push „fleet“, in the words of the build', () => {
    const ctx = setup();
    ctx.players.save({ ...user(ctx, 'Anna'), research: { computer: 2 } });
    subscribePush(ctx, 'u_Anna');
    const { id, start } = planned(ctx);
    const bert = bertJoins(ctx, id);
    // A second fleet of the leader in his own union turns back without a report.
    const arr = ctx.unions.get(id)!.arr;
    ctx.clock.t = Math.max(
      ctx.now(),
      arr - flightOf(ctx, 'u_Anna', ANNA, { lf: 1 }, 1),
    );
    expect(ctx.now()).toBeLessThan(start);
    runAction(ctx, 'u_Anna', {
      type: 'send',
      ...go('p1_1_5', { lf: 1 }, { union: id }),
    });
    const own = ctx.fleets.ofUnion(id).find((f) => f.owner === 'u_Anna')!;
    ctx.planets.save({ ...alpha(ctx), ships: { lf: 10 } });
    ctx.clock.t = start;
    tick(ctx);
    expect(ctx.fleets.get(own.id)).toMatchObject({ state: 'back' });
    expect(ctx.fleets.get(bert.id)).toMatchObject({ state: 'back' });
    expect(
      ctx.reports
        .ofPlayer('u_Anna')
        .filter((r) => String(r.title).startsWith('Angriffsverband aufgelöst')),
    ).toEqual([]);
    expect(newest(ctx, 'u_Bert').text).toBe(
      'Die Flotte des Anführers ist nicht gestartet; der Angriffsverband auf [1:4:8] ist aufgelöst. Deine Flotte kehrt um.',
    );
    expect(newest(ctx, 'u_Anna').title).toBe(
      'Geplanter Angriff nicht gestartet [1:4:8]',
    );
    expect(queuedPushes(ctx).filter((p) => p.user === 'u_Anna')).toContainEqual(
      {
        user: 'u_Anna',
        kind: 'messages',
        topic: 'fleet',
      },
    );
  });

  it('words the abort of the leader as his recall, and writes its audit entry', () => {
    const ctx = setup();
    const { id } = planned(ctx);
    bertJoins(ctx, id);
    const entry: { category: 'game'; action: string; detail?: object } = {
      category: 'game',
      action: 'cancelPlan',
    };
    runAction(ctx, 'u_Anna', { type: 'cancelPlan', id }, entry);
    expect(newest(ctx, 'u_Bert').text).toBe(
      'Der Anführer hat den Angriffsverband auf [1:4:8] zurückgerufen. Deine Flotte kehrt um.',
    );
    expect(entry.detail).toEqual({ union: id, planet: DIRK_ID });
  });
});

describe('the send of a later start (#478)', () => {
  it('refuses any cargo, each resource, and the „alles“ of the form', () => {
    const ctx = setup();
    const arr = ctx.now() + flightOf(ctx, 'u_Anna', ANNA, SHIPS, 1) + HOUR;
    const words = 'Eine Flotte, die später startet, nimmt keine Ladung mit.';
    for (const over of [
      { cargo: { c: 1, d: 1 } },
      { cargo: { m: 1, c: 1 } },
      { cargo: { d: 1 } },
      { cargoAll: 'even' },
    ])
      expect(
        refused(() =>
          send(
            ctx,
            user(ctx, 'Anna'),
            go('p1_1_5', SHIPS, { plan: arr, pct: STEP, ...over }),
          ),
        ),
        JSON.stringify(over),
      ).toBe(words);
    expect(ctx.unions.ledBy('u_Anna')).toEqual([]);
  });

  it('writes the audit entry of the send with the start and the arrival', () => {
    const ctx = setup();
    const arr = ctx.now() + flightOf(ctx, 'u_Anna', ANNA, SHIPS, 1) + HOUR;
    const sent: {
      category: 'game';
      action: string;
      target?: string | null;
      detail?: object;
    } = { category: 'game', action: 'send' };
    runAction(
      ctx,
      'u_Anna',
      { type: 'send', ...go('p1_1_5', SHIPS, { plan: arr, pct: STEP }) },
      sent,
    );
    const id = ctx.unions.ledBy('u_Anna')[0]!;
    expect(sent.target).toBe('u_Dirk');
    expect(sent.detail).toEqual({
      union: id,
      planet: DIRK_ID,
      origin: 'p1_1_5',
      mission: 'attack',
      start: ctx.unions.get(id)!.start!.at,
      due: arr,
    });
  });
});
