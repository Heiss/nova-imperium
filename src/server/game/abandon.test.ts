// Giving up a colony (#224, owner, 2026-11-16): the password like the
// deletion of the account, the refusals of D1 and D3, everything lost with
// the moon (Q1), the lock of the position per round (D2) on the way of a
// colonization and a new home planet, and a colony founded again at the
// same coordinates without any old reference.
import { describe, expect, it } from 'vitest';
import { HOUR_MS } from '../../core/abandon.ts';
import type { Fleet } from '../../core/types.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, type TestCtx, testCtx } from '../test-helpers.ts';
import { ABANDON_ERROR } from './abandon.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { mainPlanet } from './main-planet.ts';
import { placePlanet } from './planets.ts';
import { lockedUntil, positionLockedText } from './position-lock.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';

// 2026-11-17 12:00 UTC.
const START = Date.UTC(2026, 10, 17, 12, 0);
const PASSWORD = 'secret1';
const COLONY = 'p2_3_7';
const MOON = 'm2_3_7';
const AT = { g: 2, s: 3, p: 7 };

/** Anna (admin) with her first planet and a stocked colony with a moon; Bert with his first planet. */
function world(): TestCtx {
  const ctx = testCtx(START);
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, name: 'Heim' });
  ctx.clock.t += 1;
  addPlanet(ctx, 'u_Anna', {
    ...AT,
    name: 'Kolonie',
    b: { metal: 5, yard: 2 },
    ships: { lf: 3 },
    def: { rl: 4 },
    pct: { metal: 50 },
    res: { m: 900, c: 500, d: 100 },
  });
  addPlanet(ctx, 'u_Anna', {
    ...AT,
    id: MOON,
    kind: 'moon',
    name: 'Mond',
    b: { base: 1 },
  });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 5, name: 'Bertheim' });
  return ctx;
}

/** The confirmation of the target as the dialog sends it: its id and founding time. */
const confirmation = (ctx: TestCtx, target: unknown) => ({
  target,
  created:
    typeof target === 'string' ? ctx.planets.get(target)?.created : undefined,
});

const giveUp = (
  ctx: TestCtx,
  over: Record<string, unknown> = {},
  event?: AuditEntry,
) =>
  runAction(
    ctx,
    'u_Anna',
    {
      type: 'abandon',
      ...confirmation(ctx, over.target ?? COLONY),
      password: PASSWORD,
      ...over,
    },
    event,
  );

/** Everything the store holds of the planets, their parts, fleets, players and locks. */
const snapshot = (ctx: TestCtx) =>
  [
    'planets',
    'planet_buildings',
    'planet_units',
    'planet_production',
    'shipyard_queue',
    'fleets',
    'users',
    'position_locks',
  ].map((t) => ctx.db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all());

const fleet = (over: Partial<Fleet>): Fleet => ({
  id: 'f1',
  owner: 'u_Bert',
  from: 'p1_2_5',
  fromC: { g: 1, s: 2, p: 5 },
  to: COLONY,
  toC: AT,
  mission: 'spy',
  ships: { spy: 1 },
  cargo: { m: 0, c: 0, d: 0 },
  dep: START,
  arr: START + 1000,
  ret: START + 2000,
  state: 'out',
  recalled: false,
  fuel: 1,
  ...over,
});

describe('giving up a colony', () => {
  it('loses the planet and its moon with everything on them and locks the position', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    expect(giveUp(ctx, {}, event)).toBe(
      'Die Kolonie Kolonie [2:3:7] wurde aufgegeben.',
    );
    expect(ctx.planets.get(COLONY)).toBeNull();
    expect(ctx.planets.get(MOON)).toBeNull();
    for (const table of [
      'planet_buildings',
      'planet_units',
      'planet_production',
      'shipyard_queue',
    ])
      expect(
        ctx.db
          .prepare(`SELECT COUNT(*) FROM ${table} WHERE planet_id IN (?, ?)`)
          .pluck()
          .get(COLONY, MOON),
        table,
      ).toBe(0);
    // The colony's slot is free again: Anna keeps only her first planet.
    expect(ctx.planets.ofOwner('u_Anna').map((p) => p.id)).toEqual(['p1_1_5']);
    const until = ctx.now() + 24 * HOUR_MS;
    expect(ctx.planets.positionLock(AT)).toBe(until);
    // Every player sees the lock on the Sternenkarte until it ends.
    const locks = (uid: string) =>
      (stateFor(ctx, ctx.players.get(uid)!) as { locks: unknown }).locks;
    expect(locks('u_Bert')).toEqual([{ ...AT, until }]);
    ctx.clock.t = until;
    expect(locks('u_Anna')).toEqual([]);
    ctx.clock.t = START + 1;
    expect(event.detail).toEqual({ planet: COLONY, moon: MOON, until });
    // Bert's planet is untouched.
    expect(ctx.planets.get('p1_2_5')).not.toBeNull();
  });

  it('gives up a colony without a moon', () => {
    const ctx = world();
    ctx.planets.delete(MOON);
    const event = {} as AuditEntry;
    giveUp(ctx, {}, event);
    expect(ctx.planets.get(COLONY)).toBeNull();
    expect(event.detail).toMatchObject({ planet: COLONY, moon: null });
  });

  it('gives up the first planet when another planet is the main planet (D3)', () => {
    const ctx = world();
    runAction(ctx, 'u_Anna', { type: 'mainPlanet', main: COLONY });
    giveUp(ctx, { target: 'p1_1_5' });
    expect(ctx.planets.get('p1_1_5')).toBeNull();
    expect(ctx.planets.home('u_Anna')?.id).toBe(COLONY);
    expect(mainPlanet(ctx, ctx.players.get('u_Anna')!)?.id).toBe(COLONY);
    expect(ctx.planets.positionLock({ g: 1, s: 1, p: 5 })).not.toBeNull();
  });

  it('changes nothing with a wrong or missing password', () => {
    for (const password of ['wrong', '', undefined, 7, null]) {
      const ctx = world();
      const before = snapshot(ctx);
      expect(() => giveUp(ctx, { password })).toThrow(
        'Das bisherige Passwort ist falsch.',
      );
      expect(snapshot(ctx)).toEqual(before);
    }
  });

  it('asks for the password before anything else', () => {
    const ctx = world();
    expect(() => giveUp(ctx, { target: 'p1_2_5', password: 'wrong' })).toThrow(
      'Das bisherige Passwort ist falsch.',
    );
  });
});

describe('the refusals', () => {
  const refused = (
    ctx: TestCtx,
    message: string,
    over: Record<string, unknown> = {},
  ) => {
    const before = snapshot(ctx);
    expect(() => giveUp(ctx, over)).toThrow(message);
    expect(snapshot(ctx)).toEqual(before);
  };

  it('words every code in German', () => {
    expect(ABANDON_ERROR).toEqual({
      unknown: 'Das ist keiner deiner Planeten.',
      moon: 'Ein Mond kann nicht allein aufgegeben werden.',
      main: 'Der Hauptplanet kann nicht aufgegeben werden. Wähle zuerst einen anderen Hauptplaneten.',
      stale: 'Diese Kolonie gibt es so nicht mehr.',
      flights:
        'Die Kolonie kann nicht aufgegeben werden, solange Flotten zu ihr oder ihrem Mond unterwegs sind oder von dort kommen.',
      research:
        'Die Kolonie kann nicht aufgegeben werden, solange dort geforscht wird.',
      orders:
        'Die Kolonie kann nicht aufgegeben werden, solange auf ihr oder ihrem Mond gebaut wird.',
    });
  });

  it('only the owner gives up a planet', () => {
    const ctx = world();
    for (const target of ['p1_2_5', 'p9_9_9', 7, undefined])
      refused(ctx, ABANDON_ERROR.unknown, { target });
    const before = snapshot(ctx);
    expect(() =>
      runAction(ctx, 'u_Bert', {
        type: 'abandon',
        target: COLONY,
        password: PASSWORD,
      }),
    ).toThrow(ABANDON_ERROR.unknown);
    expect(snapshot(ctx)).toEqual(before);
    // A player without a planet has no main planet and nothing to give up.
    addUser(ctx, 'Cora');
    expect(() =>
      runAction(ctx, 'u_Cora', {
        type: 'abandon',
        target: COLONY,
        password: PASSWORD,
      }),
    ).toThrow(ABANDON_ERROR.unknown);
  });

  it('refuses a confirmation opened for an earlier colony at the same position, before deleting anything (owner, 2026-11-17)', () => {
    const ctx = world();
    const old = ctx.planets.get(COLONY)!.created;
    giveUp(ctx);
    // The lock ends and Anna founds a colony again at the same position.
    ctx.clock.t = ctx.planets.positionLock(AT)!;
    addPlanet(ctx, 'u_Anna', { ...AT, name: 'Neu', created: ctx.now() });
    addPlanet(ctx, 'u_Anna', { ...AT, id: MOON, kind: 'moon', name: 'Mond' });
    expect(ctx.planets.get(COLONY)!.created).not.toBe(old);
    for (const created of [old, undefined, String(old)])
      refused(ctx, ABANDON_ERROR.stale, { created });
    expect(ctx.planets.get(COLONY)?.name).toBe('Neu');
    expect(ctx.planets.get(MOON)).not.toBeNull();
    // The confirmation of the colony shown now still gives it up.
    giveUp(ctx);
    expect(ctx.planets.get(COLONY)).toBeNull();
    expect(ctx.planets.get(MOON)).toBeNull();
  });

  it('never gives up a moon alone', () => {
    refused(world(), ABANDON_ERROR.moon, { target: MOON });
  });

  it('never gives up the main planet: the first one without a choice, else the chosen one (D3)', () => {
    const ctx = world();
    refused(ctx, ABANDON_ERROR.main, { target: 'p1_1_5' });
    runAction(ctx, 'u_Anna', { type: 'mainPlanet', main: COLONY });
    refused(ctx, ABANDON_ERROR.main);
    // The last planet is always the main planet.
    const last = world();
    giveUp(last);
    refused(last, ABANDON_ERROR.main, { target: 'p1_1_5' });
  });

  it('refuses while a flight of any player starts from or flies to the planet or its moon (D1)', () => {
    for (const f of [
      fleet({ owner: 'u_Anna', from: COLONY, fromC: AT, to: 'p1_2_5' }),
      fleet({}),
      fleet({ to: MOON }),
      fleet({ owner: 'u_Anna', from: MOON, fromC: AT, to: 'p1_1_5' }),
      fleet({ state: 'back', to: MOON }),
    ]) {
      const ctx = world();
      ctx.fleets.save(f);
      refused(ctx, ABANDON_ERROR.flights);
    }
    const ctx = world();
    ctx.fleets.save(fleet({ to: 'p1_1_5', toC: { g: 1, s: 1, p: 5 } }));
    giveUp(ctx);
    expect(ctx.fleets.all()).toHaveLength(1);
  });

  it('counts a Raketenangriff in flight like a fleet, from or to the planet or its moon (#54)', () => {
    const missile = (over: Partial<Fleet>) =>
      fleet({
        mission: 'missile',
        ships: { ipm: 2 },
        ret: START + 1000,
        fuel: 0,
        ...over,
      });
    for (const f of [
      missile({ owner: 'u_Anna', from: COLONY, fromC: AT, to: 'p1_2_5' }),
      missile({ owner: 'u_Anna', from: MOON, fromC: AT, to: 'p1_2_5' }),
      missile({ owner: 'u_Bert', to: COLONY }),
      missile({ owner: 'u_Bert', to: MOON }),
    ]) {
      const ctx = world();
      ctx.fleets.save(f);
      refused(ctx, ABANDON_ERROR.flights);
    }
  });

  it('counts a fleet that holds as a flight: at the planet or its moon, or from it to another planet (#55, D1)', () => {
    const holds = { mission: 'hold', state: 'hold', hold: HOUR_MS } as const;
    for (const f of [
      fleet({ ...holds }),
      fleet({ ...holds, to: MOON }),
      fleet({
        ...holds,
        owner: 'u_Anna',
        from: COLONY,
        fromC: AT,
        to: 'p1_2_5',
        toC: { g: 1, s: 2, p: 5 },
      }),
      fleet({
        ...holds,
        owner: 'u_Anna',
        from: MOON,
        fromC: AT,
        to: 'p1_2_5',
        toC: { g: 1, s: 2, p: 5 },
      }),
    ]) {
      const ctx = world();
      ctx.fleets.save(f);
      refused(ctx, ABANDON_ERROR.flights);
    }
    // A fleet that holds at an unrelated planet does not stop it.
    const ctx = world();
    ctx.fleets.save(
      fleet({ ...holds, to: 'p1_1_5', toC: { g: 1, s: 1, p: 5 } }),
    );
    giveUp(ctx);
    expect(ctx.planets.get(COLONY)).toBeNull();
  });

  it('loses the missiles stored in the Raketenkrypta with the planet (#54, Q1)', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get(COLONY)!,
      b: { metal: 5, yard: 2, silo: 2 },
      def: { rl: 4, abm: 6, ipm: 2 },
    });
    giveUp(ctx);
    expect(ctx.planets.get(COLONY)).toBeNull();
    expect(
      ctx.db
        .prepare(
          "SELECT COUNT(*) FROM planet_units WHERE planet_id = ? AND key IN ('abm', 'ipm')",
        )
        .pluck()
        .get(COLONY),
    ).toBe(0);
  });

  it('refuses while research runs on the planet or its moon (D1)', () => {
    const queue = { key: 'energy', lvl: 1, start: START, end: START + 1e6 };
    for (const planet of [COLONY, MOON]) {
      const ctx = world();
      const anna = ctx.players.get('u_Anna')!;
      anna.rq = { ...queue, cost: [0, 800, 400], planet };
      ctx.players.save(anna);
      refused(ctx, ABANDON_ERROR.research);
    }
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    anna.rq = { ...queue, cost: [0, 800, 400], planet: 'p1_1_5' };
    ctx.players.save(anna);
    giveUp(ctx);
    expect(ctx.planets.get(COLONY)).toBeNull();
  });

  it('refuses while a building or shipyard order runs on the planet or its moon (D1)', () => {
    const bq = {
      key: 'metal',
      lvl: 6,
      start: START,
      end: START + 1e9,
      cost: [1, 2, 3] as const,
    };
    const sq = [{ key: 'lf', n: 1, unit: 1e9 }];
    for (const [id, order] of [
      [COLONY, { bq }],
      [COLONY, { sq, sqT: START }],
      [MOON, { bq }],
      [MOON, { sq, sqT: START }],
    ] as const) {
      const ctx = world();
      ctx.planets.save({ ...ctx.planets.get(id)!, ...order });
      refused(ctx, ABANDON_ERROR.orders);
    }
  });
});

describe('the lock of the position per round (D2)', () => {
  it('is 24 hours in an existing universe', () => {
    expect(roundRules(world()).abandonLock).toBe(24);
  });

  it('is set by the admin for the new round and kept without a choice', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    runAction(ctx, 'u_Anna', { type: 'reset', abandonLock: 48 }, event);
    expect(roundRules(ctx).abandonLock).toBe(48);
    expect(ctx.admin.setting('roundAbandonLock')).toBe(48);
    expect(event.detail).toMatchObject({
      before: { abandonLock: 24 },
      after: { abandonLock: 48 },
    });
    runAction(ctx, 'u_Anna', { type: 'reset', mainLock: 2 });
    expect(roundRules(ctx)).toMatchObject({ abandonLock: 48, mainLock: 2 });
    const state = stateFor(ctx, ctx.players.get('u_Anna')!) as {
      round: { abandonLock: number };
    };
    expect(state.round.abandonLock).toBe(48);
    // The colony of the new round is locked for 48 h once given up.
    addPlanet(ctx, 'u_Anna', { ...AT, created: ctx.now() + 1 });
    giveUp(ctx);
    expect(ctx.planets.positionLock(AT)).toBe(ctx.now() + 48 * HOUR_MS);
  });

  it('takes whole hours from 1 to 720 only', () => {
    const ctx = world();
    for (const abandonLock of [0, 721, 2.5, '24', null]) {
      expect(() =>
        runAction(ctx, 'u_Anna', { type: 'reset', abandonLock }),
      ).toThrow(
        'Bitte für die Sperre einer aufgegebenen Position 1 bis 720 ganze Stunden angeben.',
      );
    }
    expect(roundRules(ctx)).toMatchObject({ number: 1, abandonLock: 24 });
    runAction(ctx, 'u_Anna', { type: 'reset', abandonLock: 720 });
    expect(roundRules(ctx)).toMatchObject({ number: 2, abandonLock: 720 });
    runAction(ctx, 'u_Anna', { type: 'reset', abandonLock: 1 });
    expect(roundRules(ctx).abandonLock).toBe(1);
  });

  it('is changed by the admin during the round in the settings; a running lock keeps its end (X1)', () => {
    const ctx = world();
    addPlanet(ctx, 'u_Anna', { g: 2, s: 4, p: 3, created: ctx.now() + 1 });
    giveUp(ctx);
    const first = ctx.now() + 24 * HOUR_MS;
    const settings = { ...ctx.admin.universe(), roundAbandonLock: 6 };
    expect(() =>
      runAction(ctx, 'u_Bert', { type: 'settings', settings }),
    ).toThrow('Nur der Admin darf das.');
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'settings',
        settings: { ...settings, roundAbandonLock: 0 },
      }),
    ).toThrow(
      'Sperre einer aufgegebenen Position (Stunden): ganze Zahl von 1 bis 720.',
    );
    expect(roundRules(ctx).abandonLock).toBe(24);
    runAction(ctx, 'u_Anna', { type: 'settings', settings });
    expect(roundRules(ctx)).toMatchObject({ number: 1, abandonLock: 6 });
    expect(ctx.planets.positionLock(AT)).toBe(first);
    giveUp(ctx, { target: 'p2_4_3' });
    expect(ctx.planets.positionLock({ g: 2, s: 4, p: 3 })).toBe(
      ctx.now() + 6 * HOUR_MS,
    );
    // The dialog „Neue Runde“ offers the changed value.
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(roundRules(ctx).abandonLock).toBe(6);
    expect(ctx.admin.universe().roundAbandonLock).toBe(6);
  });

  it('a new round forgets every lock', () => {
    const ctx = world();
    giveUp(ctx);
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(ctx.planets.positionLock(AT)).toBeNull();
  });
});

describe('a locked position', () => {
  /** Bert with a Kolonistenarche on his first planet. */
  const colonist = (ctx: TestCtx) => {
    const bert = ctx.players.get('u_Bert')!;
    bert.research.impulse = 3;
    ctx.players.save(bert);
    const home = ctx.planets.get('p1_2_5')!;
    home.ships = { colony: 1 };
    home.res = { m: 1e6, c: 1e6, d: 1e6 };
    ctx.planets.save(home);
  };
  const colonize = (ctx: TestCtx) =>
    runAction(ctx, 'u_Bert', {
      type: 'send',
      planet: 'p1_2_5',
      mission: 'colonize',
      ships: { colony: 1 },
      to: AT,
    });

  it('names the end of its lock in the time of Berlin', () => {
    expect(positionLockedText(Date.UTC(2026, 10, 18, 12, 0))).toBe(
      'Diese Position ist gesperrt. Wieder besiedelbar ab 18.11.2026, 13:00.',
    );
  });

  it('cannot be colonized until the lock ends, then a fresh colony stands there', () => {
    const ctx = world();
    // Anna chose the colony once and changed the main planet back first.
    runAction(ctx, 'u_Anna', { type: 'mainPlanet', main: COLONY });
    ctx.clock.t += 7 * 24 * HOUR_MS;
    runAction(ctx, 'u_Anna', { type: 'mainPlanet', main: 'p1_1_5' });
    giveUp(ctx);
    colonist(ctx);
    const end = ctx.now() + 24 * HOUR_MS;
    expect(lockedUntil(ctx, AT, ctx.now())).toBe(end);
    expect(() => colonize(ctx)).toThrow(positionLockedText(end));
    ctx.clock.t = end - 1;
    expect(() => colonize(ctx)).toThrow(positionLockedText(end));
    expect(ctx.fleets.all()).toEqual([]);
    ctx.clock.t = end;
    expect(lockedUntil(ctx, AT, ctx.now())).toBeNull();
    expect(colonize(ctx)).toBe('Flotte unterwegs nach [2:3:7].');
    const f = ctx.fleets.all()[0]!;
    expect(f.to).toBe(COLONY);
    ctx.clock.t = f.arr;
    tick(ctx);
    // Bert's new colony: nothing of Anna's buildings, units, stock or moon.
    expect(ctx.planets.get(COLONY)).toMatchObject({
      owner: 'u_Bert',
      name: 'Kolonie',
      b: {},
      ships: {},
      def: {},
      bq: null,
      sq: [],
    });
    expect(ctx.planets.get(MOON)).toBeNull();
    // No old reference of Anna targets it: her main planet, her state, her actions.
    const anna = ctx.players.get('u_Anna')!;
    expect(anna.mainPlanet).toBe('p1_1_5');
    expect(mainPlanet(ctx, anna)?.id).toBe('p1_1_5');
    const shown = stateFor(ctx, anna, COLONY) as { planet: { id: string } };
    expect(shown.planet.id).toBe('p1_1_5');
    expect(() =>
      runAction(ctx, 'u_Anna', { type: 'rename', planet: COLONY, name: 'X' }),
    ).toThrow('Du hast keinen Zugriff auf diesen Planeten.');
    expect(ctx.fleets.all().filter((x) => x.owner === 'u_Anna')).toEqual([]);
    // Bert's main planet stays his first planet.
    expect(mainPlanet(ctx, ctx.players.get('u_Bert')!)?.id).toBe('p1_2_5');
  });

  it('turns a colonization back that arrives while the position is locked', () => {
    const ctx = world();
    ctx.planets.delete(COLONY);
    ctx.planets.delete(MOON);
    ctx.fleets.save(
      fleet({ mission: 'colonize', ships: { colony: 1 }, arr: START + 10 }),
    );
    ctx.planets.lockPosition(AT, START + 11);
    ctx.clock.t = START + 10;
    tick(ctx);
    expect(ctx.planets.get(COLONY)).toBeNull();
    expect(ctx.fleets.get('f1')).toMatchObject({ state: 'back' });
    expect(ctx.reports.ofPlayer('u_Bert')[0]).toMatchObject({
      title: 'Flotte kehrt um',
    });
  });

  it('founds the colony that arrives when the lock has ended', () => {
    const ctx = world();
    ctx.planets.delete(COLONY);
    ctx.planets.delete(MOON);
    ctx.fleets.save(
      fleet({ mission: 'colonize', ships: { colony: 1 }, arr: START + 10 }),
    );
    ctx.planets.lockPosition(AT, START + 10);
    ctx.clock.t = START + 10;
    tick(ctx);
    expect(ctx.planets.get(COLONY)).toMatchObject({ owner: 'u_Bert' });
  });

  it('gets no new home planet while it is locked', () => {
    const ctx = { ...testCtx(START), rng: () => 0 };
    addUser(ctx, 'Anna');
    ctx.admin.saveUniverse({
      ...DEFAULT_UNIVERSE,
      galaxies: 1,
      systems: 1,
      positions: 12,
    });
    // rng 0 tries position 4 only, then the first free position.
    ctx.planets.lockPosition({ g: 1, s: 1, p: 4 }, START + 1);
    expect(placePlanet(ctx, 'u_Anna', 'a', 1).p).toBe(1);
    ctx.planets.lockPosition({ g: 1, s: 1, p: 2 }, START + 1);
    expect(placePlanet(ctx, 'u_Anna', 'b', 1).p).toBe(3);
    ctx.clock.t = START + 1;
    expect(placePlanet(ctx, 'u_Anna', 'c', 1).p).toBe(4);
  });
});
