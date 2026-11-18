// The vacation mode on the server (#223, owner, 2026-11-16 and 2026-11-17):
// the entry only when nothing runs (Q1), the pause of the production and of
// every own game action (Q2), the protection from new missions while
// launched ones land (D2), the end with „Urlaubsmodus beenden“ after the
// minimum duration of the round (D1, X1) and the end with a new round and
// its notice (D3).
import { describe, expect, it } from 'vitest';
import { settle } from '../../core/settle.ts';
import { HOUR_MS } from '../../core/vacation.ts';
import type { AuditEntry } from '../audit.ts';
import { openDatabase } from '../db/database.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  type TestCtx,
  testCtx,
} from '../test-helpers.ts';
import { answerOf } from './actions.ts';
import { tick } from './arrival.ts';
import { universe } from './context.ts';
import { ACTIONS, GUILD_ACTIONS, runAction } from './dispatch.ts';
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

/** Anna (admin) with her planet and a moon, Bert with his planet. */
function world(ctx: TestCtx = testCtx(START)): TestCtx {
  addUser(ctx, 'Anna', { admin: true });
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
      end: START + 25 * HOUR_MS,
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

  it('refuses every own game action and allows the options and messages', () => {
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
    ];
    for (const [type, data] of refused)
      expect(() => act(ctx, type, data), type).toThrow(VACATION_REFUSED);
    expect(act(ctx, 'options', { probes: 2, explain: 'icon' })).not.toBeNull();
    expect(anna(ctx).probes).toBe(2);
    expect(() => act(ctx, 'delall')).not.toThrow();
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

describe('ending the vacation mode', () => {
  it('is refused before the minimum duration with the earliest end', () => {
    const ctx = world();
    start(ctx);
    ctx.clock.t = START + 24 * HOUR_MS - 1;
    expect(() => stop(ctx)).toThrow(
      'Der Urlaubsmodus ist frühestens beendbar am 18.11.2026, 13:00.',
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
    ctx.clock.t = START + 30 * HOUR_MS;
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
    act(ctx, 'settings', { settings });
    expect(roundRules(ctx).vacationHours).toBe(2);
    ctx.clock.t = START + 2 * HOUR_MS;
    expect(stop(ctx)).toBe('Urlaubsmodus beendet.');
  });
});

describe('the minimum duration of a round (D1, X1)', () => {
  it('is 24 hours in an existing universe', () => {
    expect(roundRules(world()).vacationHours).toBe(24);
  });

  it('is set by the admin for the new round and kept without a choice', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    runAction(ctx, 'u_Anna', { type: 'reset', vacationHours: 48 }, event);
    expect(event.detail).toMatchObject({
      before: { vacationHours: 24 },
      after: { vacationHours: 48 },
    });
    expect(roundRules(ctx).vacationHours).toBe(48);
    expect(ctx.admin.setting('roundVacationHours')).toBe(48);
    expect(universe(ctx).roundVacationHours).toBe(48);
    act(ctx, 'reset');
    expect(roundRules(ctx).vacationHours).toBe(48);
  });

  it('takes whole hours from 1 to 720 only', () => {
    const ctx = world();
    for (const vacationHours of [0, 721, 2.5, '24', null])
      expect(() => act(ctx, 'reset', { vacationHours })).toThrow(
        'Bitte für die Mindestdauer des Urlaubsmodus 1 bis 720 ganze Stunden angeben.',
      );
    expect(roundRules(ctx)).toMatchObject({ number: 1, vacationHours: 24 });
    act(ctx, 'reset', { vacationHours: 720 });
    expect(roundRules(ctx).vacationHours).toBe(720);
    act(ctx, 'reset', { vacationHours: 1 });
    expect(roundRules(ctx).vacationHours).toBe(1);
  });
});

describe('a new round (D3)', () => {
  it('ends every vacation and tells the player', () => {
    const ctx = world();
    start(ctx);
    act(ctx, 'reset');
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
    ctx.clock.t = START + 24 * HOUR_MS;
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
    ctx.clock.t = START + 24 * HOUR_MS;
    stop(ctx);
    expect(giveUp(ctx)).toBe('Die Kolonie Kol [2:3:7] wurde aufgegeben.');
    expect(ctx.planets.get(COLONY)).toBeNull();
  });

  it('refuses every action that is not on the allow list, one added later too', () => {
    const ctx = world();
    start(ctx);
    // The allow list of the decision: the options and messages, the end,
    // the admin and the guilds (owner, 2026-11-17 and the build of #223).
    const allowed = new Set([
      'options',
      'pushOptions',
      'read',
      'delrep',
      'delall',
      'rename',
      'mainPlanet',
      'endVacation',
      'settings',
      'reset',
      'endzeit',
    ]);
    const refused = Object.keys(ACTIONS).filter(
      (type) => !allowed.has(type) && !GUILD_ACTIONS.has(type),
    );
    expect(refused).toEqual(expect.arrayContaining(['jump', 'abandon']));
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
    act(ctx, 'reset');
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
      players: Record<string, { vacation: boolean }>;
    };
    expect(shown.me.vacation).toBeNull();
    expect(shown.round.vacationHours).toBe(24);
    expect(shown.players.u_Anna!.vacation).toBe(true);
    expect(shown.players.u_Bert!.vacation).toBe(false);
  });
});
