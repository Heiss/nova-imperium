// The vacation mode on the server (#223, owner, 2026-11-16 and 2026-11-17):
// the entry only when nothing runs (Q1), the pause of the production and of
// every own game action (Q2), the protection from new missions while
// launched ones land (D2), the end with „Urlaubsmodus beenden“ after the
// minimum duration of the round (D1, X1) and the end with a new round and
// its notice (D3).
import { describe, expect, it } from 'vitest';
import { ACTIVITY_DEFAULT, MINUTE_MS } from '../../core/activity.ts';
import { dayOf } from '../../core/market.ts';
import { settle } from '../../core/settle.ts';
import type { Fleet } from '../../core/types.ts';
import { HOUR_MS } from '../../core/vacation.ts';
import type { AuditEntry } from '../audit.ts';
import { openDatabase } from '../db/database.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  type TestCtx,
  testCtx,
} from '../test-helpers.ts';
import { answerOf } from './actions.ts';
import { recordActivity } from './activity.ts';
import { tick } from './arrival.ts';
import { universe } from './context.ts';
import { ACTIONS, runAction } from './dispatch.ts';
import { friendState } from './friends.ts';
import { heldAt } from './holding.ts';
import { currentPrices } from './market.ts';
import { addMoon } from './moons.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';
import {
  VACATION_ENTRY_ERROR,
  VACATION_NOTICE,
  VACATION_REFUSED,
  earlyText,
  inVacation,
} from './vacation.ts';

// 2026-11-17 12:00 UTC.
const START = Date.UTC(2026, 10, 17, 12, 0);
const EMPTY = { m: 0, c: 0, d: 0 };

/** The info report [V] of a guard that the host's vacation sent home (owner, 2026-11-19). */
const sentHome = (time: number, place: string) => ({
  time,
  type: 'info',
  title: 'Wache heimgeschickt [1:1:5]',
  text: `Deine Wache bei ${place} [1:1:5] wurde heimgeschickt: Der Gastgeber hat den Urlaubsmodus begonnen.`,
});

/** Anna with her planet and a moon, Bert with his planet, Carl the admin. */
function world(ctx: TestCtx = testCtx(START)): TestCtx {
  addUser(ctx, 'Anna');
  addUser(ctx, 'Carl', { admin: true });
  addUser(ctx, 'Bert');
  const home = addPlanet(ctx, 'u_Anna', {
    g: 1,
    s: 1,
    p: 5,
    name: 'Heim',
    res: EMPTY,
    b: { metal: 12 },
  });
  addMoon(ctx, home, 100, START);
  // Bert has points enough not to be under noob protection of Anna and back.
  addPlanet(ctx, 'u_Bert', {
    g: 1,
    s: 2,
    p: 6,
    name: 'Bertheim',
    b: { metal: 10 },
    ships: { lf: 10, sc: 5, probe: 3 },
  });
  return ctx;
}

const act = (ctx: TestCtx, type: string, data = {}, uid = 'u_Anna') =>
  runAction(ctx, uid, { type, ...data });
const start = (ctx: TestCtx, event?: AuditEntry) =>
  runAction(ctx, 'u_Anna', { type: 'startVacation' }, event);
const stop = (ctx: TestCtx) => act(ctx, 'endVacation');
const anna = (ctx: TestCtx) => ctx.players.get('u_Anna')!;
const home = (ctx: TestCtx) => ctx.planets.get('p1_1_5')!;
const now = (ctx: TestCtx) =>
  settle(home(ctx), ctx.now(), universe(ctx), anna(ctx));

const attack = (to = { g: 1, s: 1, p: 5 }, mission = 'attack', kind?: string) =>
  ({
    type: 'send',
    planet: 'p1_2_6',
    mission,
    ships: mission === 'spy' ? { probe: 1 } : { lf: 1, sc: 1 },
    to: { ...to, kind },
    pct: 10,
    cargo: { m: 10 },
  }) as const;

describe('starting the vacation mode', () => {
  it('starts now, after the production up to now', () => {
    const ctx = world();
    ctx.clock.t += HOUR_MS;
    const before = now(ctx);
    const event = {} as AuditEntry;
    expect(start(ctx, event)).toBe('Urlaubsmodus aktiviert.');
    expect(anna(ctx).vacation).toBe(START + HOUR_MS);
    expect(home(ctx)).toEqual(before);
    expect(home(ctx).res.m).toBeGreaterThan(0);
    expect(event.detail).toEqual({
      since: START + HOUR_MS,
      end: START + 49 * HOUR_MS,
    });
  });

  it('takes a research that is finished into the player', () => {
    const ctx = world();
    const u = anna(ctx);
    u.rq = {
      key: 'energy',
      lvl: 1,
      start: START - 10,
      end: START,
      cost: [0, 0, 0],
      planet: 'p1_1_5',
    };
    ctx.players.save(u);
    start(ctx);
    expect(anna(ctx)).toMatchObject({ research: { energy: 1 }, rq: null });
  });

  it('is refused while own fleets fly, something is built, researched or produced (Q1)', () => {
    const cases: [string, (ctx: TestCtx) => void][] = [
      [
        VACATION_ENTRY_ERROR.fleets,
        (ctx) => {
          addPlanet(ctx, 'u_Anna', { g: 2, s: 2, p: 2, ships: { sc: 1 } });
          act(ctx, 'send', {
            planet: 'p2_2_2',
            mission: 'deploy',
            ships: { sc: 1 },
            to: { g: 1, s: 1, p: 5 },
            pct: 10,
          });
        },
      ],
      [
        VACATION_ENTRY_ERROR.building,
        (ctx) => {
          const m = ctx.planets.get('m1_1_5')!;
          m.bq = {
            key: 'moonbase',
            lvl: 1,
            start: 0,
            end: START + 1,
            cost: [0, 0, 0],
          };
          ctx.planets.save(m);
        },
      ],
      [
        VACATION_ENTRY_ERROR.research,
        (ctx) => {
          const u = anna(ctx);
          u.rq = {
            key: 'energy',
            lvl: 1,
            start: 0,
            end: START + 1,
            cost: [0, 0, 0],
            planet: 'p1_1_5',
          };
          ctx.players.save(u);
        },
      ],
      [
        VACATION_ENTRY_ERROR.shipyard,
        (ctx) => {
          const p = home(ctx);
          p.sq = [{ key: 'lf', n: 1, unit: 1000 }];
          p.sqT = START;
          ctx.planets.save(p);
        },
      ],
    ];
    for (const [message, running] of cases) {
      const ctx = world();
      running(ctx);
      const before = ctx.planets.all();
      expect(() => start(ctx)).toThrow(message);
      expect(anna(ctx).vacation).toBeNull();
      expect(ctx.planets.all()).toEqual(before);
    }
  });

  it('words what still runs', () => {
    expect(VACATION_ENTRY_ERROR).toEqual({
      fleets:
        'Der Urlaubsmodus kann nicht aktiviert werden, solange eigene Flotten unterwegs sind.',
      building:
        'Der Urlaubsmodus kann nicht aktiviert werden, solange gebaut wird.',
      research:
        'Der Urlaubsmodus kann nicht aktiviert werden, solange geforscht wird.',
      shipyard:
        'Der Urlaubsmodus kann nicht aktiviert werden, solange die Schiffsschmiede arbeitet.',
    });
  });

  it('is possible once the building is done', () => {
    const ctx = world();
    const p = home(ctx);
    p.bq = { key: 'metal', lvl: 11, start: 0, end: START, cost: [0, 0, 0] };
    ctx.planets.save(p);
    start(ctx);
    expect(home(ctx)).toMatchObject({ bq: null, b: { metal: 11 } });
  });
});

describe('during the vacation mode', () => {
  it('produces nothing on the planets and the moon, also after a restart (Q2)', () => {
    const db = openDatabase(':memory:');
    const ctx = world(testCtx(START, 42, db));
    start(ctx);
    const stock = home(ctx).res;
    ctx.clock.t += 100 * HOUR_MS;
    expect(now(ctx).res).toEqual(stock);
    const again = testCtx(ctx.clock.t, 7, db);
    expect(
      settle(home(again), again.now(), universe(again), anna(again)).res,
    ).toEqual(stock);
    const shown = stateFor(again, anna(again)) as {
      me: { vacation: number | null };
    };
    expect(shown.me.vacation).toBe(START);
  });

  it('refuses everything but the end and the push settings (owner, 2026-11-18)', () => {
    const ctx = world();
    start(ctx);
    const refused: [string, object][] = [
      ['build', { planet: 'p1_1_5', key: 'metal' }],
      ['research', { planet: 'p1_1_5', key: 'energy' }],
      ['order', { planet: 'p1_1_5', key: 'lf', n: 1 }],
      ['pct', { planet: 'p1_1_5', key: 'metal', v: 50 }],
      ['send', attack({ g: 1, s: 2, p: 6 })],
      ['claimDailyReward', {}],
      ['startVacation', {}],
      ['options', { probes: 2, explain: 'icon' }],
      ['mainPlanet', { main: 'p1_1_5' }],
      ['rename', { planet: 'p1_1_5', name: 'Neu' }],
      ['read', {}],
      ['delrep', { id: 'x' }],
      ['delall', {}],
      ['createGuild', { tag: 'AB', name: 'Abc' }],
      ['sendGuildChat', { text: 'Hallo' }],
      ['seeGuildChat', {}],
    ];
    for (const [type, data] of refused)
      expect(() => act(ctx, type, data), type).toThrow(VACATION_REFUSED);
    expect(anna(ctx).probes).toBe(1);
    expect(act(ctx, 'pushOptions', { off: ['fleet'] })).toBe('Gespeichert.');
    expect(
      (stateFor(ctx, anna(ctx)) as { me: { pushOff: string[] } }).me.pushOff,
    ).toEqual(['fleet']);
  });

  it('refuses the actions of an admin in vacation mode', () => {
    const ctx = world();
    runAction(ctx, 'u_Carl', { type: 'startVacation' });
    for (const type of ['settings', 'reset', 'endzeit'])
      expect(() => act(ctx, type, {}, 'u_Carl'), type).toThrow(
        VACATION_REFUSED,
      );
  });

  it('refuses every new mission of another player to a planet or the moon (D2)', () => {
    const ctx = world();
    start(ctx);
    for (const mission of ['attack', 'spy', 'transport'])
      for (const kind of [undefined, 'moon'])
        expect(
          () => act(ctx, 'send', attack(undefined, mission, kind), 'u_Bert'),
          `${mission} ${kind}`,
        ).toThrow('Dieser Spieler ist im Urlaubsmodus.');
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('refuses a Mondbruch at the moon of a player in vacation mode like every mission, before its own checks (#95, #223)', () => {
    const ctx = world();
    const bert = ctx.planets.get('p1_2_6')!;
    ctx.planets.save({ ...bert, ships: { ...bert.ships, dstar: 2 } });
    start(ctx);
    for (const ships of [{ dstar: 1 }, { lf: 1 }])
      expect(() =>
        act(
          ctx,
          'send',
          { ...attack(undefined, 'moonbreak', 'moon'), ships },
          'u_Bert',
        ),
      ).toThrow('Dieser Spieler ist im Urlaubsmodus.');
    expect(ctx.fleets.all()).toEqual([]);
    expect(ctx.planets.get('m1_1_5')).not.toBeNull();
    expect(ctx.planets.get('p1_2_6')!.ships.dstar).toBe(2);
  });

  it('protects against a spy who may spy (Auspex-Lehre 1, #175) and lets him spy before', () => {
    const ctx = world();
    const bert = ctx.players.get('u_Bert')!;
    ctx.players.save({ ...bert, research: { ...bert.research, spy: 1 } });
    const spy = attack(undefined, 'spy');
    expect(act(ctx, 'send', spy, 'u_Bert')).toBe(
      'Flotte unterwegs nach [1:1:5].',
    );
    ctx.fleets.delete(ctx.fleets.all()[0]!.id);
    start(ctx);
    expect(() => act(ctx, 'send', spy, 'u_Bert')).toThrow(
      'Dieser Spieler ist im Urlaubsmodus.',
    );
  });

  it('lets an attack launched before the entry land as usual (D2)', () => {
    const ctx = world();
    act(ctx, 'send', attack(), 'u_Bert');
    const fleet = ctx.fleets.all()[0]!;
    start(ctx);
    ctx.clock.t = fleet.arr;
    tick(ctx);
    const after = ctx.fleets.get(fleet.id)!;
    expect(after.state).toBe('back');
    const titles = ctx.reports.ofPlayer('u_Anna').map((r) => r.title);
    expect(titles.join(' ')).toContain('Feindkontakt! Heim [1:1:5]');
  });
});

describe('a Vermessung and the vacation mode (#190, #223)', () => {
  it('is refused like every action while the sender is in vacation mode, and flies after the end', () => {
    const ctx = world();
    const a = anna(ctx);
    ctx.players.save({ ...a, research: { ...a.research, carto: 1 } });
    ctx.planets.save({
      ...home(ctx),
      ships: { probe: 2 },
      res: { m: 0, c: 0, d: 1000 },
    });
    const survey = {
      planet: 'p1_1_5',
      mission: 'survey',
      ships: { probe: 1 },
      to: { g: 1, s: 1, p: 9 },
      pct: 10,
      cargo: {},
    };
    start(ctx);
    expect(() => act(ctx, 'send', survey)).toThrow(VACATION_REFUSED);
    expect(ctx.fleets.all()).toEqual([]);
    expect(home(ctx).ships).toEqual({ probe: 2 });
    ctx.clock.t = START + 50 * HOUR_MS;
    stop(ctx);
    expect(act(ctx, 'send', survey)).toBe('Flotte unterwegs nach [1:1:9].');
    expect(ctx.fleets.all()[0]).toMatchObject({ mission: 'survey' });
  });
});

describe('an Expedition and the vacation mode (#93, #223)', () => {
  /** Anna with Kreuzzugs-Kartografie and ships; the expedition position of the system 1:1. */
  const expo = (ctx: TestCtx) => {
    const a = anna(ctx);
    ctx.players.save({ ...a, research: { ...a.research, expo: 4 } });
    ctx.planets.save({
      ...home(ctx),
      ships: { lc: 5 },
      res: { m: 0, c: 0, d: 100000 },
    });
    return {
      planet: 'p1_1_5',
      mission: 'expedition',
      ships: { lc: 1 },
      to: { g: 1, s: 1, p: 16 },
      pct: 10,
      stay: 1,
    };
  };

  it('is refused like every action while the sender is in vacation mode, and flies after the end', () => {
    const ctx = world();
    const order = expo(ctx);
    start(ctx);
    expect(() => act(ctx, 'send', order)).toThrow(VACATION_REFUSED);
    expect(ctx.fleets.all()).toEqual([]);
    expect(home(ctx).ships).toEqual({ lc: 5 });
    ctx.clock.t = START + 50 * HOUR_MS;
    stop(ctx);
    expect(act(ctx, 'send', order)).toBe('Flotte unterwegs nach [1:1:16].');
    expect(ctx.fleets.all()[0]).toMatchObject({ mission: 'expedition' });
  });

  it('keeps the vacation from starting while an expedition flies', () => {
    const ctx = world();
    act(ctx, 'send', expo(ctx));
    expect(() => start(ctx)).toThrow(VACATION_ENTRY_ERROR.fleets);
    expect(anna(ctx).vacation).toBeNull();
  });

  it('needs no protection of a target: no player is there, so a player in vacation is not asked', () => {
    const ctx = world();
    const order = expo(ctx);
    // Bert in vacation mode does not matter to an expedition of Anna.
    const bert = ctx.players.get('u_Bert')!;
    ctx.players.save({ ...bert, vacation: START });
    expect(act(ctx, 'send', order)).toBe('Flotte unterwegs nach [1:1:16].');
  });
});

describe('a Wache stellen and the vacation mode (#55, #223)', () => {
  /** Anna and Bert in one guild, so they may hold at each other. */
  const allies = (ctx: TestCtx): TestCtx => {
    ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Anna');
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.accept('u_Bert');
    return ctx;
  };
  const hold = (to = { g: 1, s: 1, p: 5 }, kind?: string) =>
    ({ ...attack(to, 'hold', kind), hold: 1 }) as const;

  it('is refused like every action while the sender is in vacation mode, a launch and a recall, and works after the end', () => {
    const ctx = allies(world());
    const bert = ctx.players.get('u_Bert')!;
    expect(act(ctx, 'send', { ...hold(), planet: 'p1_2_6' }, 'u_Bert')).toBe(
      'Flotte unterwegs nach [1:1:5].',
    );
    const flying = ctx.fleets.all()[0]!;
    ctx.players.save({ ...bert, vacation: START });
    const before = ctx.fleets.all();
    const stock = ctx.planets.get('p1_2_6')!.ships;
    expect(() => act(ctx, 'send', hold(), 'u_Bert')).toThrow(VACATION_REFUSED);
    expect(() => act(ctx, 'recall', { id: flying.id }, 'u_Bert')).toThrow(
      VACATION_REFUSED,
    );
    expect(ctx.fleets.all()).toEqual(before);
    expect(ctx.planets.get('p1_2_6')!.ships).toEqual(stock);
    ctx.players.save({ ...ctx.players.get('u_Bert')!, vacation: null });
    expect(act(ctx, 'recall', { id: flying.id }, 'u_Bert')).toBe(
      'Flotte zurückgerufen.',
    );
  });

  it('refuses a recall of a fleet that holds while the owner is in vacation mode', () => {
    const ctx = allies(world());
    act(ctx, 'send', { ...hold(), planet: 'p1_2_6' }, 'u_Bert');
    const fleet = ctx.fleets.all()[0]!;
    ctx.clock.t = fleet.arr;
    tick(ctx);
    expect(ctx.fleets.get(fleet.id)).toMatchObject({ state: 'hold' });
    const bert = ctx.players.get('u_Bert')!;
    ctx.players.save({ ...bert, vacation: START });
    expect(() => act(ctx, 'recall', { id: fleet.id }, 'u_Bert')).toThrow(
      VACATION_REFUSED,
    );
    expect(ctx.fleets.get(fleet.id)).toMatchObject({
      state: 'hold',
      recalled: false,
    });
  });

  it('is refused at a planet or the moon of a player in vacation mode, an ally too, before the noob protection (#55, #223)', () => {
    const ctx = allies(world());
    start(ctx);
    for (const kind of [undefined, 'moon'])
      expect(
        () => act(ctx, 'send', hold(undefined, kind), 'u_Bert'),
        String(kind),
      ).toThrow('Dieser Spieler ist im Urlaubsmodus.');
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('turns a Wache stellen launched before the entry home at its arrival instead of holding (owner, 2026-11-19)', () => {
    const ctx = allies(world());
    act(ctx, 'send', { ...hold(), planet: 'p1_2_6' }, 'u_Bert');
    const fleet = ctx.fleets.all()[0]!;
    start(ctx);
    // On its way it flies on, as every launched flight does (D2).
    expect(ctx.fleets.get(fleet.id)).toMatchObject({ state: 'out' });
    ctx.clock.t = fleet.arr;
    tick(ctx);
    // It does not hold: it flies home for as long as it flew there, without
    // the holding time, and is no guard of the planet.
    const flight = fleet.arr - fleet.dep;
    expect(ctx.fleets.get(fleet.id)).toMatchObject({
      state: 'back',
      ret: fleet.arr + flight,
      recalled: false,
    });
    expect(heldAt(ctx, 'p1_1_5')).toEqual([]);
    // The owner is told at the arrival, once; the host gets nothing.
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      sentHome(fleet.arr, 'Heim'),
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    const ships = ctx.planets.get('p1_2_6')!.ships;
    ctx.clock.t = fleet.arr + flight;
    tick(ctx);
    expect(ctx.fleets.get(fleet.id)).toBeNull();
    expect(ctx.planets.get('p1_2_6')!.ships.lf).toBe((ships.lf ?? 0) + 1);
    expect(ctx.reports.ofPlayer('u_Bert').map((r) => r.title)).toEqual([
      'Rückkehr zu Bertheim [1:2:6]',
      'Wache heimgeschickt [1:1:5]',
    ]);
  });

  it('pushes the info report of the guard that was sent home to its owner under „Flotte“', () => {
    const ctx = allies(world());
    subscribePush(ctx, 'u_Bert');
    act(ctx, 'send', { ...hold(), planet: 'p1_2_6' }, 'u_Bert');
    const fleet = ctx.fleets.all()[0]!;
    start(ctx);
    expect(queuedPushes(ctx)).toEqual([]);
    ctx.clock.t = fleet.arr;
    tick(ctx);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Bert', kind: 'messages', topic: 'fleet' },
    ]);
  });

  it('turns a Wache stellen to the moon of the host home at its arrival too (owner, 2026-11-19)', () => {
    const ctx = allies(world());
    act(
      ctx,
      'send',
      { ...hold(undefined, 'moon'), planet: 'p1_2_6' },
      'u_Bert',
    );
    const fleet = ctx.fleets.all()[0]!;
    expect(fleet).toMatchObject({ to: 'm1_1_5', state: 'out' });
    start(ctx);
    ctx.clock.t = fleet.arr;
    tick(ctx);
    expect(ctx.fleets.get(fleet.id)).toMatchObject({
      state: 'back',
      ret: fleet.arr + (fleet.arr - fleet.dep),
    });
    expect(heldAt(ctx, 'm1_1_5')).toEqual([]);
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      sentHome(fleet.arr, 'Mond (Mond)'),
    ]);
  });
});

describe('a vacation and the fleets that hold at the host (#55, #223, owner, 2026-11-19)', () => {
  /** Anna (planet and moon) in a guild with Bert; Cora, a third player, has a planet. */
  function guards(): TestCtx {
    const ctx = world();
    addUser(ctx, 'Cora');
    addPlanet(ctx, 'u_Cora', { g: 1, s: 3, p: 7, name: 'Coraheim' });
    return ctx;
  }

  /** A fleet of `owner` that holds at `to` since an hour ago, for 8 hours, with a flight of an hour. */
  function guard(
    ctx: TestCtx,
    id: string,
    owner: string,
    to: string,
    over: Partial<Fleet> = {},
  ): Fleet {
    const home = ctx.planets.home(owner)!;
    const target = ctx.planets.get(to)!;
    const f: Fleet = {
      id,
      owner,
      from: home.id,
      fromC: { g: home.g, s: home.s, p: home.p },
      to,
      toC: { g: target.g, s: target.s, p: target.p },
      mission: 'hold',
      ships: { lf: 2 },
      cargo: { m: 7, c: 0, d: 0 },
      dep: START - 2 * HOUR_MS,
      arr: START - HOUR_MS,
      ret: START + 8 * HOUR_MS,
      state: 'hold',
      recalled: false,
      fuel: 3,
      hold: 8 * HOUR_MS,
      ...over,
    };
    ctx.fleets.save(f);
    return f;
  }

  it('starts as before with no fleet holding at the host: nothing flies home', () => {
    const ctx = guards();
    // Bert's guard at Cora's planet is nobody's business of Anna's vacation.
    const other = guard(ctx, 'g0', 'u_Bert', 'p1_3_7');
    expect(start(ctx)).toBe('Urlaubsmodus aktiviert.');
    expect(ctx.fleets.all()).toEqual([other]);
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([]);
  });

  it('sends the one fleet that holds at the planet home at once: the flight back takes as long as the flight there, the holding time is dropped', () => {
    const ctx = guards();
    const g = guard(ctx, 'g1', 'u_Bert', 'p1_1_5');
    expect(start(ctx)).toBe('Urlaubsmodus aktiviert.');
    expect(ctx.fleets.get('g1')).toEqual({
      ...g,
      state: 'back',
      ret: START + HOUR_MS,
    });
    expect(heldAt(ctx, 'p1_1_5')).toEqual([]);
    // Due at its return, not at the end of its holding time: it comes home
    // with its cargo and the owner finds the report of a return.
    ctx.clock.t = START + HOUR_MS - 1;
    expect(tick(ctx)).toBe(0);
    ctx.clock.t = START + HOUR_MS;
    expect(tick(ctx)).toBe(1);
    expect(ctx.fleets.get('g1')).toBeNull();
    expect(ctx.planets.get('p1_2_6')!.ships.lf).toBe(12);
    expect(ctx.planets.get('p1_2_6')!.res.m).toBeGreaterThanOrEqual(7);
    // Told at the start of the vacation, then the report of the return.
    expect(ctx.reports.ofPlayer('u_Bert').map((r) => r.title)).toEqual([
      'Rückkehr zu Bertheim [1:2:6]',
      'Wache heimgeschickt [1:1:5]',
    ]);
    expect(ctx.reports.ofPlayer('u_Bert')[1]).toMatchObject(
      sentHome(START, 'Heim'),
    );
    // The guard did not come back to the host.
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
  });

  it('sends two fleets of different owners home, one holding at the planet and one at the moon, and keeps a guard that holds at another host', () => {
    const ctx = guards();
    const atPlanet = guard(ctx, 'g1', 'u_Bert', 'p1_1_5');
    const atMoon = guard(ctx, 'g2', 'u_Cora', 'm1_1_5');
    const elsewhere = guard(ctx, 'g3', 'u_Cora', 'p1_2_6');
    // A fleet still on its way is not a guard yet: it flies on until its arrival.
    const coming = guard(ctx, 'g4', 'u_Bert', 'p1_1_5', {
      state: 'out',
      arr: START + 2 * HOUR_MS,
      ret: START + 11 * HOUR_MS,
    });
    ctx.clock.t += HOUR_MS;
    const at = ctx.now();
    start(ctx);
    expect(ctx.fleets.get('g1')).toEqual({
      ...atPlanet,
      state: 'back',
      ret: at + HOUR_MS,
    });
    expect(ctx.fleets.get('g2')).toEqual({
      ...atMoon,
      state: 'back',
      ret: at + HOUR_MS,
    });
    expect(ctx.fleets.get('g3')).toEqual(elsewhere);
    expect(ctx.fleets.get('g4')).toEqual(coming);
    // One report per sent fleet for its owner, with the place it held at;
    // none for the fleet that holds elsewhere or still flies, nor for the host.
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      sentHome(at, 'Heim'),
    ]);
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      sentHome(at, 'Mond (Mond)'),
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
  });

  it('leaves a fleet whose holding time is over as it is due: it left at the end of its time', () => {
    const ctx = guards();
    const g = guard(ctx, 'g1', 'u_Bert', 'p1_1_5');
    // The 8 hours ended 30 minutes ago; the tick has not run yet.
    ctx.clock.t = g.arr + 8 * HOUR_MS + HOUR_MS / 2;
    start(ctx);
    expect(ctx.fleets.get('g1')).toMatchObject({
      state: 'back',
      ret: g.arr + 8 * HOUR_MS + HOUR_MS,
    });
  });

  it('does not start while the player has a fleet that holds at another host: it is his own fleet out (unchanged)', () => {
    const ctx = guards();
    const mine = guard(ctx, 'm1', 'u_Anna', 'p1_2_6');
    guard(ctx, 'g1', 'u_Bert', 'p1_1_5');
    expect(() => start(ctx)).toThrow(VACATION_ENTRY_ERROR.fleets);
    expect(anna(ctx).vacation).toBeNull();
    // Nothing was sent home by the refused entry.
    expect(ctx.fleets.get('g1')).toMatchObject({ state: 'hold' });
    expect(ctx.fleets.get('m1')).toEqual(mine);
  });

  it('lets a host who ended the vacation hold again: new guards are welcome', () => {
    const ctx = guards();
    ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Anna');
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.accept('u_Bert');
    start(ctx);
    ctx.clock.t = START + 50 * HOUR_MS;
    stop(ctx);
    expect(
      act(ctx, 'send', { ...attack(undefined, 'hold'), hold: 1 }, 'u_Bert'),
    ).toContain('unterwegs');
  });
});

describe('ending the vacation mode', () => {
  it('is refused before the minimum duration with the earliest end', () => {
    const ctx = world();
    start(ctx);
    ctx.clock.t = START + 48 * HOUR_MS - 1;
    expect(() => stop(ctx)).toThrow(
      'Der Urlaubsmodus ist frühestens beendbar am 19.11.2026, 13:00.',
    );
    expect(earlyText(START)).toBe(
      'Der Urlaubsmodus ist frühestens beendbar am 17.11.2026, 13:00.',
    );
    expect(anna(ctx).vacation).toBe(START);
  });

  it('is refused without a vacation', () => {
    expect(() => stop(world())).toThrow('Du bist nicht im Urlaubsmodus.');
  });

  it('ends after the minimum duration; the production goes on from then on', () => {
    const ctx = world();
    start(ctx);
    const stock = home(ctx).res;
    ctx.clock.t = START + 50 * HOUR_MS;
    expect(stop(ctx)).toBe('Urlaubsmodus beendet.');
    expect(anna(ctx).vacation).toBeNull();
    expect(home(ctx)).toMatchObject({ res: stock, t: ctx.now() });
    expect(ctx.planets.get('m1_1_5')!.t).toBe(ctx.now());
    ctx.clock.t += HOUR_MS;
    expect(now(ctx).res.m).toBeGreaterThan(stock.m);
    expect(act(ctx, 'send', attack(), 'u_Bert')).toContain('unterwegs');
  });

  it('follows the minimum duration the admin changes during the round (X1)', () => {
    const ctx = world();
    start(ctx);
    const settings = { ...universe(ctx), roundVacationHours: 2 };
    // The admin changes it, the player in vacation cannot.
    expect(() => act(ctx, 'settings', { settings })).toThrow(VACATION_REFUSED);
    act(ctx, 'settings', { settings }, 'u_Carl');
    expect(roundRules(ctx).vacationHours).toBe(2);
    ctx.clock.t = START + 2 * HOUR_MS;
    expect(stop(ctx)).toBe('Urlaubsmodus beendet.');
  });
});

describe('the minimum duration of a round (D1, X1)', () => {
  it('is 48 hours in an existing universe (owner, 2026-11-18)', () => {
    expect(roundRules(world()).vacationHours).toBe(48);
  });

  it('is set by the admin for the new round and kept without a choice', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    runAction(ctx, 'u_Carl', { type: 'reset', vacationHours: 72 }, event);
    expect(event.detail).toMatchObject({
      before: { vacationHours: 48 },
      after: { vacationHours: 72 },
    });
    expect(roundRules(ctx).vacationHours).toBe(72);
    expect(ctx.admin.setting('roundVacationHours')).toBe(72);
    expect(universe(ctx).roundVacationHours).toBe(72);
    act(ctx, 'reset', {}, 'u_Carl');
    expect(roundRules(ctx).vacationHours).toBe(72);
  });

  it('takes whole hours from 1 to 720 only', () => {
    const ctx = world();
    for (const vacationHours of [0, 721, 2.5, '24', null])
      expect(() => act(ctx, 'reset', { vacationHours }, 'u_Carl')).toThrow(
        'Bitte für die Mindestdauer des Urlaubsmodus 1 bis 720 ganze Stunden angeben.',
      );
    expect(roundRules(ctx)).toMatchObject({ number: 1, vacationHours: 48 });
    act(ctx, 'reset', { vacationHours: 720 }, 'u_Carl');
    expect(roundRules(ctx).vacationHours).toBe(720);
    act(ctx, 'reset', { vacationHours: 1 }, 'u_Carl');
    expect(roundRules(ctx).vacationHours).toBe(1);
  });
});

describe('a new round (D3)', () => {
  it('ends every vacation and tells the player', () => {
    const ctx = world();
    start(ctx);
    act(ctx, 'reset', {}, 'u_Carl');
    expect(anna(ctx).vacation).toBeNull();
    const reports = ctx.reports.ofPlayer('u_Anna');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      type: 'info',
      title: 'Urlaubsmodus beendet',
      text: 'Die neue Runde hat deinen Urlaubsmodus beendet.',
    });
    expect(VACATION_NOTICE).toEqual({
      title: 'Urlaubsmodus beendet',
      text: 'Die neue Runde hat deinen Urlaubsmodus beendet.',
    });
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([]);
  });
});

describe('the Warp-Tor, giving up a colony and the Auspex-Phalanx (#230, #224, #53)', () => {
  const HOME_MOON = 'm1_1_5';
  const FAR_MOON = 'm2_5_9';
  const COLONY = 'p2_3_7';
  const gates = (ctx: TestCtx) => {
    const far = addPlanet(ctx, 'u_Anna', { g: 2, s: 5, p: 9, name: 'Fern' });
    addMoon(ctx, far, 100, START);
    for (const id of [HOME_MOON, FAR_MOON])
      ctx.planets.save({
        ...ctx.planets.get(id)!,
        b: { moonbase: 1, jumpgate: 1 },
        ships: { lc: 5 },
      });
    ctx.admin.saveUniverse({ ...ctx.admin.universe(), speed: 1 });
  };
  const jump = (ctx: TestCtx) =>
    act(ctx, 'jump', { planet: HOME_MOON, to: FAR_MOON, ships: { lc: 2 } });
  const giveUp = (ctx: TestCtx) =>
    act(ctx, 'abandon', {
      target: COLONY,
      created: ctx.planets.get(COLONY)!.created,
      password: 'secret1',
    });

  it('refuses a jump during the vacation mode and changes nothing; it works again after the end', () => {
    const ctx = world();
    gates(ctx);
    start(ctx);
    expect(() => jump(ctx), 'jump').toThrow(VACATION_REFUSED);
    expect(ctx.planets.get(HOME_MOON)!.ships).toEqual({ lc: 5 });
    expect(ctx.planets.get(FAR_MOON)!.ships).toEqual({ lc: 5 });
    expect(ctx.planets.gateReady(HOME_MOON)).toBe(0);
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    expect(jump(ctx)).toBeNull();
    expect(ctx.planets.get(FAR_MOON)!.ships).toEqual({ lc: 7 });
  });

  it('refuses giving up a colony during the vacation mode and keeps planet and moon; it works again after the end', () => {
    const ctx = world();
    const colony = addPlanet(ctx, 'u_Anna', { g: 2, s: 3, p: 7, name: 'Kol' });
    addMoon(ctx, colony, 100, START);
    start(ctx);
    expect(() => giveUp(ctx), 'abandon').toThrow(VACATION_REFUSED);
    expect(ctx.planets.get(COLONY)).not.toBeNull();
    expect(ctx.planets.get('m2_3_7')).not.toBeNull();
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    expect(giveUp(ctx)).toBe('Die Kolonie Kol [2:3:7] wurde aufgegeben.');
    expect(ctx.planets.get(COLONY)).toBeNull();
  });

  it('refuses every action that is not on the allow list, the guild actions and one added later too', () => {
    const ctx = world();
    start(ctx);
    // The allow list of the decision (owner, 2026-11-18): the end of the
    // vacation and the push settings, and the private messages go on as
    // normal (owner, 2026-11-21, Q25). The guild actions are refused too.
    const allowed = new Set([
      'endVacation',
      'pushOptions',
      'sendPrivateMessage',
      'readPrivateMessages',
      'deletePrivateMessage',
      'deletePrivateConversation',
      'reportPrivateMessage',
      'blockPlayer',
      'unblockPlayer',
      'privateMessageOptions',
      'olderPrivateMessages',
      'openPrivateConversation',
      'sentPrivateMessages',
    ]);
    const refused = Object.keys(ACTIONS).filter((type) => !allowed.has(type));
    expect(refused).toEqual(
      expect.arrayContaining(['jump', 'abandon', 'sendGuildChat', 'options']),
    );
    for (const type of refused)
      expect(() => act(ctx, type), type).toThrow(VACATION_REFUSED);
    ACTIONS.anyNewAction = () => null;
    try {
      expect(() => act(ctx, 'anyNewAction')).toThrow(VACATION_REFUSED);
    } finally {
      delete ACTIONS.anyNewAction;
    }
  });

  it('lets the Auspex-Phalanx scan a planet whose owner is in vacation mode (owner, 2026-11-17)', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get(HOME_MOON)!,
      b: { moonbase: 1, phalanx: 2 },
      res: { m: 0, c: 0, d: 12000 },
    });
    runAction(ctx, 'u_Bert', { type: 'startVacation' });
    expect(ctx.players.get('u_Bert')!.vacation).toBe(START);
    const answer = answerOf(
      act(ctx, 'scan', { planet: HOME_MOON, target: 'p1_2_6' }),
    );
    expect(answer.data).toEqual({
      scan: { by: HOME_MOON, target: 'p1_2_6', flights: [] },
    });
    expect(ctx.planets.get(HOME_MOON)!.res.d).toBe(7000);
  });

  it('refuses a scan of a player who is in vacation mode himself', () => {
    const ctx = world();
    start(ctx);
    expect(() =>
      act(ctx, 'scan', { planet: HOME_MOON, target: 'p1_2_6' }),
    ).toThrow(VACATION_REFUSED);
  });
});

describe('the buddy list and the vacation mode (#227, #223)', () => {
  /** Anna with an incoming request (Dora), an own request (Carl) and a friend (Bert), then in vacation. */
  function away(): TestCtx {
    const ctx = world();
    addUser(ctx, 'Dora');
    addUser(ctx, 'Eva');
    act(ctx, 'requestFriend', { name: 'Anna' }, 'u_Dora');
    act(ctx, 'requestFriend', { name: 'Carl' });
    act(ctx, 'requestFriend', { name: 'Bert' });
    act(ctx, 'answerFriend', { uid: 'u_Anna', accept: true }, 'u_Bert');
    start(ctx);
    return ctx;
  }

  it('refuses every own friend action of a player in vacation mode and changes no link', () => {
    const ctx = away();
    const links = ctx.friends.links('u_Anna');
    expect(links).toHaveLength(3);
    const refused: [string, object][] = [
      ['requestFriend', { name: 'Eva' }],
      ['answerFriend', { uid: 'u_Dora', accept: true }],
      ['answerFriend', { uid: 'u_Dora', accept: false }],
      ['cancelFriend', { uid: 'u_Carl' }],
      ['removeFriend', { uid: 'u_Bert' }],
    ];
    for (const [type, data] of refused)
      expect(() => act(ctx, type, data), type).toThrow(VACATION_REFUSED);
    expect(ctx.friends.links('u_Anna')).toEqual(links);
    expect(ctx.friends.links('u_Eva')).toEqual([]);
  });

  it('shows the lock screen nothing of the buddy list, even with requests and friends', () => {
    const ctx = away();
    const shown = stateFor(ctx, anna(ctx));
    expect(shown).not.toHaveProperty('friends');
    expect(JSON.stringify(shown)).not.toMatch(/u_Dora|u_Carl|u_Bert/);
  });

  it('lets others still ask him; he sees and answers it after the end', () => {
    const ctx = away();
    expect(act(ctx, 'requestFriend', { name: 'anna' }, 'u_Eva')).toBe(
      'Anfrage gesendet.',
    );
    expect(ctx.friends.links('u_Eva')).toEqual([
      { from: 'u_Eva', to: 'u_Anna', status: 'pending' },
    ]);
    expect(stateFor(ctx, anna(ctx))).not.toHaveProperty('friends');
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    const { friends } = stateFor(ctx, anna(ctx)) as {
      friends: { incoming: string[] };
    };
    expect(friends.incoming).toEqual(['u_Dora', 'u_Eva']);
    expect(act(ctx, 'answerFriend', { uid: 'u_Eva', accept: true })).toBe(
      'Anfrage angenommen.',
    );
  });

  it('shows a friend in vacation mode offline after the threshold: he records no activity', () => {
    const ctx = world();
    act(ctx, 'requestFriend', { name: 'Bert' });
    act(ctx, 'answerFriend', { uid: 'u_Anna', accept: true }, 'u_Bert');
    const bert = () => ctx.players.get('u_Bert')!;
    const online = () =>
      friendState(ctx, 'u_Anna', ACTIVITY_DEFAULT.recent).list;
    recordActivity(ctx, bert(), 'action');
    runAction(ctx, 'u_Bert', { type: 'startVacation' });
    expect(online()).toEqual([{ id: 'u_Bert', online: true }]);
    ctx.clock.t += ACTIVITY_DEFAULT.recent * MINUTE_MS;
    expect(online()).toEqual([{ id: 'u_Bert', online: false }]);
    // His login and his clicks on the lock screen move nothing.
    recordActivity(ctx, bert(), 'login');
    recordActivity(ctx, bert(), 'action');
    expect(online()).toEqual([{ id: 'u_Bert', online: false }]);
    // After the end the next activity counts again.
    ctx.clock.t = START + 48 * HOUR_MS;
    runAction(ctx, 'u_Bert', { type: 'endVacation' });
    recordActivity(ctx, bert(), 'action');
    expect(online()).toEqual([{ id: 'u_Bert', online: true }]);
  });
});

describe('the marketplace and the vacation mode (#171, #223)', () => {
  const trade = (ctx: TestCtx, uid = 'u_Anna', planet = 'p1_1_5') =>
    act(
      ctx,
      'trade',
      // With the price the player sees (#406).
      {
        give: 'm',
        get: 'c',
        amount: 1000,
        planet,
        price: currentPrices(ctx).mc,
      },
      uid,
    );
  const stock = (ctx: TestCtx, id = 'p1_1_5') => ctx.planets.get(id)!.res;

  /** Anna and Bert each with a Handelsposten and Adamant; Bert has moved the price. */
  function market(): TestCtx {
    const ctx = world();
    for (const id of ['p1_1_5', 'p1_2_6'])
      ctx.planets.save({
        ...ctx.planets.get(id)!,
        b: { ...ctx.planets.get(id)!.b, market: 1, robot: 4 },
        res: { m: 5000, c: 100, d: 0 },
      });
    trade(ctx, 'u_Bert', 'p1_2_6');
    return ctx;
  }

  it('refuses `trade` for a player in vacation mode and changes no stock, price or amount; it works again after the end', () => {
    const ctx = market();
    const prices = currentPrices(ctx);
    const used = ctx.market.used('u_Anna', dayOf(ctx.now()));
    start(ctx);
    expect(() => trade(ctx)).toThrow(VACATION_REFUSED);
    expect(stock(ctx)).toEqual({ m: 5000, c: 100, d: 0 });
    expect(currentPrices(ctx)).toEqual(prices);
    expect(ctx.market.used('u_Anna', dayOf(ctx.now()))).toEqual(used);
    // The other player still trades, the vacation is no one else's rule.
    expect(trade(ctx, 'u_Bert', 'p1_2_6')).toMatch(/getauscht/);
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    expect(trade(ctx)).toMatch(/getauscht/);
    expect(stock(ctx).m).toBe(4000);
  });

  it('sends the lock screen no market data, and the full state again after the end', () => {
    const ctx = market();
    expect(stateFor(ctx, anna(ctx))).toHaveProperty('market');
    start(ctx);
    const shown = stateFor(ctx, anna(ctx));
    expect(shown).not.toHaveProperty('market');
    expect(JSON.stringify(shown)).not.toMatch(/"prices"|"used"|"market"/);
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    expect(stateFor(ctx, anna(ctx))).toHaveProperty('market');
  });
});

describe('the words and the notice', () => {
  it('says „Im Urlaubsmodus nicht möglich.“ to a refused action', () => {
    expect(VACATION_REFUSED).toBe('Im Urlaubsmodus nicht möglich.');
  });

  it('asks the vacation of a known player only; an unknown one is not away', () => {
    const ctx = world();
    start(ctx);
    expect(inVacation(ctx)('u_Anna')).toBe(true);
    expect(inVacation(ctx)('u_Bert')).toBe(false);
    expect(inVacation(ctx)('u_Gone')).toBe(false);
  });

  it('pushes the notice of a new round as a server announcement', () => {
    const ctx = world();
    ctx.db
      .prepare(`INSERT INTO push_subscriptions VALUES (?, ?, 'k', 'a')`)
      .run('e', 'u_Anna');
    start(ctx);
    act(ctx, 'reset', {}, 'u_Carl');
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'announcement' },
    ]);
  });
});

describe('the state', () => {
  it('shows the own vacation, the minimum duration and who is away', () => {
    const ctx = world();
    start(ctx);
    const shown = stateFor(ctx, ctx.players.get('u_Bert')!) as {
      me: { vacation: number | null };
      round: { vacationHours: number };
      players: Record<string, { vacation?: boolean }>;
    };
    expect(shown.me.vacation).toBeNull();
    expect(shown.round.vacationHours).toBe(48);
    expect(shown.players.u_Anna!.vacation).toBe(true);
    expect(shown.players.u_Bert).not.toHaveProperty('vacation');
  });

  it('is a lock screen without any game for a player in vacation mode (owner, 2026-11-18)', () => {
    const ctx = world();
    ctx.reports.add(
      'u_Anna',
      { id: 'r1', time: START, type: 'info', title: 'T', text: 'x' },
      60,
    );
    start(ctx);
    const shown = stateFor(ctx, anna(ctx)) as Record<string, unknown> & {
      me: Record<string, unknown>;
      round: { vacationHours: number };
    };
    expect(shown).toEqual({
      round: roundRules(ctx),
      now: ctx.now(),
      cfg: universe(ctx),
      me: {
        id: 'u_Anna',
        name: 'Anna',
        research: {},
        rq: null,
        probes: 1,
        explain: anna(ctx).explain,
        levelTable: anna(ctx).levelTable,
        pushOff: [],
        readAt: 0,
        admin: false,
        vacation: START,
      },
      planet: null,
      labs: [],
      fleets: [],
      reports: [],
      players: {},
      galaxy: [],
      debris: [],
      admin: null,
      // The lock screen offers „Nachrichten“ (owner, 2026-11-21, Q28).
      privateMessages: { friendsOnly: false, blocked: [], conversations: [] },
    });
    expect(shown.round.vacationHours).toBe(48);
  });

  it('carries the own private messages on the lock screen and nothing of the conversations of others (owner, 2026-11-21, Q28)', () => {
    const ctx = world();
    const say = (from: string, to: string, text: string) => {
      ctx.clock.t += 3000;
      act(ctx, 'sendPrivateMessage', { name: to, text }, `u_${from}`);
    };
    say('Bert', 'Carl', 'GEHEIM-ZWISCHEN-BERT-UND-CARL');
    start(ctx);
    say('Bert', 'Anna', 'Hallo im Urlaub');
    const shown = stateFor(ctx, anna(ctx)) as {
      privateMessages: {
        conversations: { with: string; unread: number; last: { id: number } }[];
      };
      reports: unknown[];
    };
    expect(shown.privateMessages.conversations).toMatchObject([
      { with: 'Bert', unread: 1, more: false },
    ]);
    expect(JSON.stringify(shown)).not.toContain('GEHEIM');
    expect(shown.reports).toEqual([]);
    // The player replies, reads and pages in the vacation; the reports stay locked.
    const id = shown.privateMessages.conversations[0]!.last;
    act(ctx, 'readPrivateMessages', { name: 'Bert' });
    expect(act(ctx, 'olderPrivateMessages', { before: id.id })).toMatchObject({
      data: { older: [], more: false },
    });
    // Both loads work on the lock screen (Q34): a conversation, and „Gesendet“.
    expect(act(ctx, 'openPrivateConversation', { name: 'Bert' })).toMatchObject(
      { data: { messages: [{ text: 'Hallo im Urlaub' }], more: false } },
    );
    expect(act(ctx, 'sentPrivateMessages', {})).toMatchObject({
      data: { sent: [], more: false },
    });
    say('Anna', 'Bert', 'Antwort aus dem Urlaub');
    expect(act(ctx, 'sentPrivateMessages', {})).toMatchObject({
      data: { sent: [{ to: 'Bert', text: 'Antwort aus dem Urlaub' }] },
    });
    // The lock state delivers the newer messages of the open conversation too.
    const open = (
      stateFor(ctx, anna(ctx), undefined, { name: 'Bert', after: id.id }) as {
        privateMessages: { open?: { with: string; messages: unknown[] } };
      }
    ).privateMessages.open;
    expect(open).toMatchObject({ with: 'Bert', messages: [{ mine: true }] });
    expect(() => act(ctx, 'read')).toThrow(VACATION_REFUSED);
    expect(anna(ctx).vacation).not.toBeNull();
  });

  it('lists every player exactly: `vacation: true` only for the ones in vacation mode, with their scores (#78, #223)', () => {
    const ctx = world();
    start(ctx);
    const shown = (uid: string) =>
      (stateFor(ctx, ctx.players.get(uid)!) as { players: unknown }).players;
    const expected = {
      u_Anna: {
        name: 'Anna',
        points: 19,
        // metal 12 by number (#422: Anzahl by default)
        scores: { economy: 12, military: 0 },
        vacation: true,
      },
      u_Bert: {
        name: 'Bert',
        points: 71,
        // metal 10; lf 10, sc 5 and probe 3 by number
        scores: { economy: 10, military: 18 },
      },
      u_Carl: {
        name: 'Carl',
        points: 0,
        scores: { economy: 0, military: 0 },
      },
    };
    // The same list for every player who is not in vacation mode.
    expect(shown('u_Bert')).toEqual(expected);
    expect(shown('u_Carl')).toEqual(expected);
    // After the end nobody is marked.
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    expect(shown('u_Bert')).toEqual({
      u_Anna: { ...expected.u_Anna, vacation: undefined },
      u_Bert: expected.u_Bert,
      u_Carl: expected.u_Carl,
    });
    expect(shown('u_Bert')).not.toHaveProperty('u_Anna.vacation');
  });

  it('keeps the account of a player in vacation mode in the lock screen, whatever was asked for, on every device (#223)', () => {
    const ctx = world();
    start(ctx);
    // An admin with research, a queue, probes and a read mark: none of it shows.
    for (const uid of ['u_Anna', 'u_Carl']) {
      const u = ctx.players.get(uid)!;
      ctx.players.save({
        ...u,
        research: { energy: 3 },
        rq: {
          key: 'energy',
          lvl: 4,
          start: START,
          end: START + 1,
          cost: [1, 1, 1],
        },
        probes: 7,
        readAt: 123,
        explain: 'hidden',
        vacation: START,
      });
    }
    const locked = (uid: string, selected?: unknown) =>
      stateFor(ctx, ctx.players.get(uid)!, selected) as Record<string, unknown>;
    for (const [uid, admin] of [
      ['u_Anna', false],
      ['u_Carl', true],
    ] as const)
      expect(locked(uid), uid).toEqual({
        round: roundRules(ctx),
        now: ctx.now(),
        cfg: universe(ctx),
        me: {
          id: uid,
          name: uid === 'u_Anna' ? 'Anna' : 'Carl',
          research: {},
          rq: null,
          probes: 1,
          explain: 'hidden',
          levelTable: 'icon',
          pushOff: [],
          readAt: 0,
          admin,
          vacation: START,
        },
        planet: null,
        labs: [],
        fleets: [],
        reports: [],
        players: {},
        galaxy: [],
        debris: [],
        admin: null,
        privateMessages: { friendsOnly: false, blocked: [], conversations: [] },
      });
    // A second device selects a planet, or sends anything: the same lock screen.
    for (const selected of ['p1_1_5', 'm1_1_5', 5, {}, null])
      expect(locked('u_Anna', selected), JSON.stringify(selected)).toEqual(
        locked('u_Anna'),
      );
  });

  it('keeps a player in vacation in the highscore of the others, with the categories (#78, #223)', () => {
    const ctx = world();
    start(ctx);
    const players = (
      stateFor(ctx, ctx.players.get('u_Bert')!) as {
        players: Record<string, { vacation?: boolean; scores?: unknown }>;
      }
    ).players;
    expect(players.u_Anna!.vacation).toBe(true);
    expect(players.u_Anna!.scores).toBeDefined();
    expect(players.u_Bert).not.toHaveProperty('vacation');
  });

  it('is the full game again after the end, also for an admin', () => {
    const ctx = world();
    start(ctx);
    ctx.clock.t = START + 48 * HOUR_MS;
    stop(ctx);
    const shown = stateFor(ctx, anna(ctx)) as { planet: { id: string } };
    expect(shown.planet.id).toBe('p1_1_5');
    expect(
      (stateFor(ctx, ctx.players.get('u_Carl')!) as { admin: unknown }).admin,
    ).not.toBeNull();
  });
});
