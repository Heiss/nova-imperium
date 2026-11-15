// „Endzeit“ (#161): the admin's gift fleet, its flight and its arrival.
import { describe, expect, it } from 'vitest';
import { SHIPS } from '../../core/catalog.ts';
import {
  giftCargo,
  giftLevels,
  giftShips,
  standing,
} from '../../core/endzeit.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import type { Fleet } from '../../core/types.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  type TestCtx,
  testCtx,
} from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import {
  ARRIVAL_TEXT,
  ENDZEIT_ROUND,
  START_TEXT,
  endzeit,
  endzeitState,
  giftArrive,
} from './endzeit.ts';
import { pointsMap } from './points.ts';

const MINUTE = 60000;

/** Anna (admin) with a home planet and a colony, Bert with a home planet. */
function world(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, name: 'Heim' });
  ctx.clock.t += 1;
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 7, name: 'Kolonie' });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 5 });
  return ctx;
}

const ring = (ctx: TestCtx, minutes: unknown = 90) =>
  runAction(ctx, 'u_Anna', { type: 'endzeit', minutes });

const giftOf = (ctx: TestCtx, owner: string): Fleet =>
  ctx.fleets.all().find((f) => f.owner === owner && f.gift)!;

const subscribe = (ctx: TestCtx, uid: string) =>
  ctx.db
    .prepare(`INSERT INTO push_subscriptions VALUES (?, ?, 'k', 'a')`)
    .run(`e_${uid}`, uid);

const pushes = (ctx: TestCtx, kind: string) =>
  ctx.db
    .prepare('SELECT event_key AS key FROM push_jobs WHERE kind = ?')
    .all(kind) as { key: string }[];

describe('ringing in the Endzeit', () => {
  it('is for the admin only', () => {
    const ctx = world();
    expect(() =>
      runAction(ctx, 'u_Bert', { type: 'endzeit', minutes: 90 }),
    ).toThrow('Nur der Admin darf das.');
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('sends every player with a home planet a gift fleet to it', () => {
    const ctx = world();
    // Suspended and admin accounts are included; a player without a planet is not.
    ctx.admin.suspend('u_Bert', 'Test', null);
    addUser(ctx, 'Carl');
    // The universe speed does not change the flight time.
    ctx.admin.saveUniverse({ ...DEFAULT_UNIVERSE, speed: 10 });
    const t = ctx.now();
    expect(ring(ctx)).toBe('Die Endzeit ist eingeläutet. Gaben unterwegs: 2.');
    expect(ctx.fleets.all().map((f) => f.owner)).toEqual(['u_Anna', 'u_Bert']);
    expect(giftOf(ctx, 'u_Anna')).toEqual({
      id: expect.any(String),
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_1_5',
      toC: { g: 1, s: 1, p: 5 },
      mission: 'deploy',
      ships: giftShips(),
      cargo: giftCargo(),
      dep: t,
      arr: t + 90 * MINUTE,
      ret: t + 180 * MINUTE,
      state: 'out',
      recalled: false,
      fuel: 0,
      gift: true,
    });
    expect(giftOf(ctx, 'u_Bert')).toMatchObject({
      from: 'p1_2_5',
      to: 'p1_2_5',
    });
    expect(giftOf(ctx, 'u_Anna').ships).not.toHaveProperty('sat');
    // The gift takes no fleet slot.
    expect(ctx.fleets.count('u_Anna')).toBe(0);
    // Nothing is taken from the home planet.
    expect(ctx.planets.home('u_Anna')).toMatchObject({
      ships: {},
      res: { m: 100000, c: 100000, d: 100000 },
    });
  });

  it('tells every recipient with the text of the owner, with push', () => {
    const ctx = world();
    addUser(ctx, 'Carl');
    subscribe(ctx, 'u_Bert');
    ring(ctx);
    for (const uid of ['u_Anna', 'u_Bert'])
      expect(ctx.reports.ofPlayer(uid)).toMatchObject([
        { time: ctx.now(), type: 'info', title: 'Endzeit', text: START_TEXT },
      ]);
    expect(START_TEXT).toBe(
      'Der allwissende Gottkaiser war gnädig und hat die Endzeit eingeläutet. Er möchte sehen, wie ihr ihn unterhaltet, wenn ihr seine Fähigkeiten bekommt.',
    );
    expect(ctx.reports.ofPlayer('u_Carl')).toEqual([]);
    expect(pushes(ctx, 'messages')).toHaveLength(1);
    // A server announcement in the push options (#192).
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Bert', kind: 'messages', topic: 'announcement' },
    ]);
  });

  it('takes a flight time of 1 minute to 72 h, whole minutes', () => {
    for (const bad of [0, 4321, 1.5, 'abc', undefined, null, -5]) {
      const ctx = world();
      expect(() =>
        runAction(ctx, 'u_Anna', { type: 'endzeit', minutes: bad }),
      ).toThrow('Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.');
      expect(ctx.fleets.all()).toEqual([]);
      expect(endzeitState(ctx)).toEqual({ minutes: 240, done: false });
    }
    for (const good of [1, 4320, '15']) {
      const ctx = world();
      ring(ctx, good);
      expect(giftOf(ctx, 'u_Anna').arr).toBe(ctx.now() + Number(good) * MINUTE);
    }
  });

  it('happens once per round and keeps the default flight time', () => {
    const ctx = world();
    expect(endzeitState(ctx)).toEqual({ minutes: 240, done: false });
    ring(ctx, 30);
    expect(ctx.admin.setting(ENDZEIT_ROUND)).toBe(1);
    // Only the round is stored; the time of the dialog is for this trigger.
    expect(
      ctx.db
        .prepare(
          "SELECT key, value FROM settings WHERE key LIKE 'endzeit%' ORDER BY key",
        )
        .all(),
    ).toEqual([{ key: 'endzeitRound', value: 1 }]);
    expect(ctx.admin.universe().endzeitMinutes).toBe(240);
    expect(endzeitState(ctx)).toEqual({ minutes: 240, done: true });
    expect(() => ring(ctx, 30)).toThrow(
      'Die Endzeit wurde in dieser Runde schon eingeläutet.',
    );
    expect(ctx.fleets.all()).toHaveLength(2);
    // A new round allows it again.
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(endzeitState(ctx)).toEqual({ minutes: 240, done: false });
    ring(ctx, 45);
    expect(ctx.fleets.all()).toHaveLength(2);
    expect(endzeitState(ctx)).toEqual({ minutes: 240, done: true });
    expect(ctx.admin.setting(ENDZEIT_ROUND)).toBe(2);
  });

  it('offers the default of the universe settings first (owner, 2026-11-14)', () => {
    const ctx = world();
    runAction(ctx, 'u_Anna', {
      type: 'settings',
      settings: { ...DEFAULT_UNIVERSE, endzeitMinutes: 15 },
    });
    expect(endzeitState(ctx)).toEqual({ minutes: 15, done: false });
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'settings',
        settings: { ...DEFAULT_UNIVERSE, endzeitMinutes: 4321 },
      }),
    ).toThrow(
      'Flugzeit der Endzeit-Gabe (Minuten): ganze Zahl von 1 bis 4320.',
    );
    expect(endzeitState(ctx).minutes).toBe(15);
    // The dialog's time differs: it applies, the default stays.
    ring(ctx, 600);
    expect(giftOf(ctx, 'u_Anna').arr).toBe(ctx.now() + 600 * MINUTE);
    expect(endzeitState(ctx)).toEqual({ minutes: 15, done: true });
  });

  it('records the round, the time and the recipients in the audit entry', () => {
    const ctx = world();
    const entry = { category: 'admin.write' as const, action: 'endzeit' };
    const anna = ctx.players.get('u_Anna')!;
    endzeit(ctx, anna, { minutes: 5 }, entry);
    expect(entry).toMatchObject({
      detail: {
        round: 1,
        minutes: 5,
        recipients: 2,
        due: ctx.now() + 5 * MINUTE,
      },
    });
    // Without an entry it works the same.
    const other = world();
    expect(
      endzeit(other, other.players.get('u_Anna')!, { minutes: 5 }),
    ).toContain('Gaben unterwegs: 2');
  });

  it('cannot be recalled', () => {
    const ctx = world();
    ring(ctx);
    const gift = giftOf(ctx, 'u_Anna');
    ctx.clock.t += MINUTE;
    expect(() =>
      runAction(ctx, 'u_Anna', { type: 'recall', id: gift.id }),
    ).toThrow('Die Gabe des Gottkaisers kann nicht zurückgerufen werden.');
    expect(ctx.fleets.get(gift.id)).toEqual(gift);
  });

  it('counts its ships in the points from the start, like any fleet (D8)', () => {
    const ctx = world();
    const before = pointsMap(ctx);
    ring(ctx);
    const value = Object.entries(giftShips()).reduce((s, [k, n]) => {
      const c = SHIPS[k]!.cost;
      return s + (c[0] + c[1] + c[2]) * n;
    }, 0);
    const after = pointsMap(ctx);
    expect(after.u_Anna! - before.u_Anna!).toBeGreaterThanOrEqual(
      Math.floor(value / 1000) - 1,
    );
    expect(after.u_Anna! - before.u_Anna!).toBeLessThanOrEqual(
      Math.floor(value / 1000),
    );
  });
});

describe('the gift arrives', () => {
  it('lands ships and cargo above the storage and raises research and buildings', () => {
    const ctx = world();
    const home = ctx.planets.home('u_Anna')!;
    ctx.planets.save({
      ...home,
      b: { robot: 25, metal: 10, lab: 3 },
      ships: { sc: 3, sat: 4 },
      res: { m: 0, c: 0, d: 0 },
    });
    const anna = ctx.players.get('u_Anna')!;
    ctx.players.save({ ...anna, research: { weapons: 10, energy: 2 } });
    subscribe(ctx, 'u_Anna');
    ring(ctx, 60);
    const gift = giftOf(ctx, 'u_Anna');
    ctx.clock.t = gift.arr;
    tick(ctx);
    const need = giftLevels();
    const after = ctx.planets.home('u_Anna')!;
    expect(after.ships).toEqual({ ...giftShips(), sc: 45, sat: 4 });
    expect(after.res.m).toBeGreaterThanOrEqual(1_000_000);
    expect(after.res.c).toBeGreaterThanOrEqual(1_000_000);
    expect(after.res.d).toBe(1_000_000);
    // The moon-only buildings (the Mondzitadelle the Auspex-Phalanx needs)
    // do not stand on the home planet (#53, „Geklärt, Nachtrag 2“).
    expect(need.b.moonbase).toBe(1);
    expect(after.b).toEqual({
      ...standing(need.b, 'planet'),
      robot: 25,
      metal: 10,
    });
    expect(after.b.moonbase).toBeUndefined();
    expect(after.b).toMatchObject({ yard: 20, lab: 20, nanite: 5 });
    expect(ctx.players.get('u_Anna')!.research).toEqual({
      ...need.r,
      weapons: 10,
    });
    expect(ctx.players.get('u_Anna')!.research.ifn).toBe(1);
    // Only the home planet (D3).
    expect(ctx.planets.get('p1_1_7')!.b).toEqual({});
    expect(ctx.fleets.get(gift.id)).toBeNull();
    const reports = ctx.reports.ofPlayer('u_Anna');
    expect(reports[0]).toMatchObject({
      time: gift.arr,
      title: ARRIVAL_TEXT,
      text: ARRIVAL_TEXT,
    });
    expect(ARRIVAL_TEXT).toBe('Die Gabe des Gottkaisers ist eingetroffen.');
    expect(
      reports.some((r) => String(r.title).startsWith('Verlegung erreicht')),
    ).toBe(false);
    expect(pushes(ctx, 'messages')).toHaveLength(2);
    // The start is an announcement, the arrival an own fleet's report (#192).
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'announcement' },
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
    ]);
    // Bert's gift arrived at the same time.
    expect(ctx.planets.home('u_Bert')!.b).toMatchObject(
      standing(need.b, 'planet'),
    );
  });

  it('counts the raised buildings and research in the points from the arrival', () => {
    const ctx = world();
    ring(ctx, 60);
    const flying = pointsMap(ctx).u_Anna!;
    ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
    tick(ctx);
    expect(pointsMap(ctx).u_Anna!).toBeGreaterThan(flying);
  });

  it('cancels and refunds a build the new level overtakes; a higher one stays', () => {
    const ctx = world();
    const home = ctx.planets.home('u_Anna')!;
    const end = ctx.now() + 1000 * MINUTE;
    ctx.planets.save({
      ...home,
      b: { yard: 2 },
      bq: {
        key: 'yard',
        lvl: 3,
        start: ctx.now(),
        end,
        cost: [1600, 800, 400],
      },
      res: { m: 0, c: 0, d: 0 },
    });
    const bert = ctx.planets.home('u_Bert')!;
    ctx.planets.save({
      ...bert,
      b: { robot: 25 },
      bq: { key: 'robot', lvl: 26, start: ctx.now(), end, cost: [1, 2, 3] },
    });
    subscribe(ctx, 'u_Anna');
    ctx.db
      .prepare(
        "INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at) VALUES ('e_u_Anna', 'buildings', ?, ?, ?)",
      )
      .run(`${home.id}:${ctx.now()}`, end, end);
    ring(ctx, 60);
    ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
    tick(ctx);
    const after = ctx.planets.home('u_Anna')!;
    expect(after.bq).toBeNull();
    expect(after.b.yard).toBe(20);
    expect(after.res.m).toBeGreaterThanOrEqual(1_001_600);
    expect(after.res.d).toBe(1_000_400);
    expect(pushes(ctx, 'buildings')).toEqual([]);
    expect(ctx.planets.home('u_Bert')!.bq).toMatchObject({
      key: 'robot',
      lvl: 26,
    });
  });

  it('keeps a build of a key the gift does not raise', () => {
    const ctx = world();
    const home = ctx.planets.home('u_Anna')!;
    const end = ctx.now() + 1000 * MINUTE;
    ctx.planets.save({
      ...home,
      bq: { key: 'metal', lvl: 1, start: ctx.now(), end, cost: [60, 15, 0] },
    });
    ring(ctx, 60);
    ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
    tick(ctx);
    expect(ctx.planets.home('u_Anna')!.bq).toMatchObject({ key: 'metal' });
  });

  it('cancels and refunds overtaken research where it started', () => {
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    const end = ctx.now() + 1000 * MINUTE;
    ctx.players.save({
      ...anna,
      research: { energy: 2 },
      rq: {
        key: 'energy',
        lvl: 3,
        start: ctx.now(),
        end,
        cost: [0, 3200, 1600],
        planet: 'p1_1_7',
      },
    });
    const colony = ctx.planets.get('p1_1_7')!;
    ctx.planets.save({ ...colony, res: { m: 0, c: 0, d: 0 } });
    subscribe(ctx, 'u_Anna');
    ctx.db
      .prepare(
        "INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at) VALUES ('e_u_Anna', 'research', 'r', ?, ?)",
      )
      .run(end, end);
    ring(ctx, 60);
    const arr = giftOf(ctx, 'u_Anna').arr;
    ctx.clock.t = arr;
    tick(ctx);
    const after = ctx.players.get('u_Anna')!;
    expect(after.rq).toBeNull();
    expect(after.research.energy).toBe(12);
    const paid = ctx.planets.get('p1_1_7')!;
    expect(paid.res.c).toBeGreaterThanOrEqual(3200);
    expect(paid.res.d).toBe(1600);
    expect(paid.t).toBe(arr);
    expect(pushes(ctx, 'research')).toEqual([]);
  });

  it('refunds research without a planet on the home planet; higher research stays', () => {
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    const end = ctx.now() + 1000 * MINUTE;
    const rq = {
      key: 'energy',
      lvl: 1,
      start: ctx.now(),
      end,
      cost: [0, 800, 400] as [number, number, number],
    };
    ctx.players.save({ ...anna, rq });
    ctx.planets.save({
      ...ctx.planets.home('u_Anna')!,
      res: { m: 0, c: 0, d: 0 },
    });
    const bert = ctx.players.get('u_Bert')!;
    const keep = { ...rq, key: 'weapons', lvl: 11, planet: 'p1_2_5' };
    ctx.players.save({ ...bert, research: { weapons: 10 }, rq: keep });
    ring(ctx, 60);
    ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
    tick(ctx);
    expect(ctx.players.get('u_Anna')!.rq).toBeNull();
    expect(ctx.planets.home('u_Anna')!.res.d).toBe(1_000_400);
    expect(ctx.players.get('u_Bert')!.rq).toEqual(keep);
  });

  it('refunds research of the home planet there, with the gift', () => {
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    ctx.players.save({
      ...anna,
      rq: {
        key: 'energy',
        lvl: 1,
        start: ctx.now(),
        end: ctx.now() + 1000 * MINUTE,
        cost: [0, 800, 400],
        planet: 'p1_1_5',
      },
    });
    ctx.planets.save({
      ...ctx.planets.home('u_Anna')!,
      res: { m: 0, c: 0, d: 0 },
    });
    ring(ctx, 60);
    ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
    tick(ctx);
    expect(ctx.planets.home('u_Anna')!.res.d).toBe(1_000_400);
    expect(ctx.planets.home('u_Anna')!.ships.dstar).toBe(42);
  });

  it.each(['p9_9_9', 'p1_2_5'])(
    'refunds on the home planet when %s is gone or foreign',
    (planet) => {
      const ctx = world();
      const anna = ctx.players.get('u_Anna')!;
      ctx.players.save({
        ...anna,
        rq: {
          key: 'energy',
          lvl: 1,
          start: ctx.now(),
          end: ctx.now() + 1000 * MINUTE,
          cost: [0, 800, 400],
          planet,
        },
      });
      ctx.planets.save({
        ...ctx.planets.home('u_Anna')!,
        res: { m: 0, c: 0, d: 0 },
      });
      ring(ctx, 60);
      ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
      tick(ctx);
      expect(ctx.planets.home('u_Anna')!.res.d).toBe(1_000_400);
      // Bert got his own gift, nothing of Anna's refund.
      expect(ctx.planets.home('u_Bert')!.res.d).toBe(1_100_000);
    },
  );

  it('a research that finished before the arrival counts; a later one is overtaken', () => {
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    ctx.players.save({
      ...anna,
      rq: {
        key: 'weapons',
        lvl: 15,
        start: ctx.now(),
        end: ctx.now() + 30 * MINUTE,
        cost: [1, 1, 1],
      },
    });
    ring(ctx, 60);
    ctx.clock.t = giftOf(ctx, 'u_Anna').arr;
    tick(ctx);
    expect(ctx.players.get('u_Anna')!).toMatchObject({
      rq: null,
      research: { weapons: 15 },
    });
  });

  it('lands without research or message when the owner is unknown', () => {
    const ctx = world();
    ring(ctx, 60);
    const gift = { ...giftOf(ctx, 'u_Anna'), owner: 'u_Ghost' };
    const t = ctx.planets.home('u_Anna')!;
    giftArrive(ctx, gift, t);
    expect(t.b).toMatchObject(standing(giftLevels().b, 'planet'));
    expect(ctx.players.get('u_Anna')!.research).toEqual({});
    expect(ctx.fleets.get(gift.id)).toBeNull();
  });
});
