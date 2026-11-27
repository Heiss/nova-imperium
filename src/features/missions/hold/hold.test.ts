// Wache stellen (#55): its typed data, its own check (an ally with room at
// the planet) and its arrival, which starts the holding.
import { describe, expect, it } from 'vitest';
import {
  HOLD_REASON_TEXT,
  HOLD_REPORT_TITLE,
} from '../../../core/hold-texts.ts';
import type { SendTarget } from '../../../core/missions.ts';
import type { Fleet } from '../../../core/types.ts';
import { lockEndText } from '../../../server/game/main-planet.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';
import { texts } from './texts.de.ts';

const fleet = { owner: 'a', from: 'p1', ships: { lf: 1 } };

/** Anna and Bert as friends: allies under the default „Verbündete“. */
const befriend = (ctx: ReturnType<typeof testCtx>): void => {
  ctx.friends.request('u_Anna', 'u_Bert');
  ctx.friends.accept('u_Anna', 'u_Bert');
};

/** A hold of Anna that arrives at `to` at `now`, for an hour. */
const flying = (to: string, now: number): Fleet => ({
  id: 'f1',
  owner: 'u_Anna',
  from: 'p1_1_5',
  fromC: { g: 1, s: 1, p: 5 },
  to,
  toC: { g: 1, s: 2, p: 6 },
  mission: 'hold',
  ships: { lf: 3 },
  cargo: { m: 5, c: 0, d: 0 },
  dep: now - 10,
  arr: now,
  ret: now + 3_600_010,
  state: 'out',
  recalled: false,
  fuel: 4,
  hold: 3_600_000,
});

const at = (
  over: Partial<SendTarget> = {},
): SendTarget & { asked: string[] } => {
  const asked: string[] = [];
  return {
    planet: { id: 'p2', owner: 'b' },
    debris: false,
    protects: () => false,
    vacation: () => false,
    ally: (owner) => {
      asked.push(owner);
      return true;
    },
    holding: () => [],
    asked,
    ...over,
  };
};

describe('hold', () => {
  it('has its data: after the Bergung, to an ally, with cargo, returning, holding', () => {
    expect(rules).toMatchObject({
      order: 70,
      target: 'ally',
      cargo: true,
      returns: true,
      silent: false,
      alertsGuild: false,
      holds: true,
    });
    expect(texts).toEqual({ n: 'Wache stellen' });
  });

  it('flies only to an ally, asked for the owner of the planet', () => {
    const yes = at();
    expect(canSend(fleet, yes)).toBeUndefined();
    expect(yes.asked).toEqual(['b']);
    expect(canSend(fleet, at({ ally: () => false }))).toBe('notAlly');
    // Without the server's answer nobody is an ally.
    expect(canSend(fleet, at({ ally: undefined }))).toBe('notAlly');
    expect(canSend(fleet, at({ planet: null }))).toBe('notAlly');
  });

  it('keeps the limits of the planet: 15 fleets of at most four players', () => {
    const four = ['b', 'c', 'd', 'e'];
    expect(canSend(fleet, at({ holding: () => four }))).toBe('holdPlayers');
    expect(
      canSend(fleet, at({ holding: () => ['a', 'b', 'c', 'd'] })),
    ).toBeUndefined();
    const full = Array.from({ length: 15 }, () => 'a');
    expect(canSend(fleet, at({ holding: () => full }))).toBe('holdFleets');
    expect(canSend(fleet, at({ holding: undefined }))).toBeUndefined();
  });

  it('starts holding at the planet of an ally and tells the host (#440, 242c)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    befriend(ctx);
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
    const t = addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6 });
    const f: Fleet = {
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: t.id,
      toC: { g: 1, s: 2, p: 6 },
      mission: 'hold',
      ships: { lf: 3 },
      cargo: { m: 5, c: 0, d: 0 },
      dep: ctx.now() - 10,
      arr: ctx.now(),
      ret: ctx.now() + 3_600_010,
      state: 'out',
      recalled: false,
      fuel: 4,
      hold: 3_600_000,
    };
    ctx.fleets.save(f);
    const before = ctx.planets.all();
    onArrive(ctx, f);
    expect(ctx.fleets.get('f1')).toEqual({ ...f, state: 'hold' });
    expect(ctx.planets.all()).toEqual(before);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      {
        type: 'info',
        time: f.arr,
        title: HOLD_REPORT_TITLE.arrival,
        text: `Anna hält mit einer Flotte Wache bei ${t.name} [1:2:6] bis ${lockEndText(f.arr + 3_600_000)}.`,
      },
    ]);
  });

  it('turns home at its arrival when it is no longer allowed, with the report of the re-check (#440, 4a)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
    const t = addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6 });
    const f = flying(t.id, ctx.now());
    ctx.fleets.save(f);
    // No bond between Anna and Bert.
    onArrive(ctx, f);
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ret: f.arr + (f.arr - f.dep),
      recalled: false,
    });
    expect(ctx.reports.ofPlayer('u_Anna')).toMatchObject([
      {
        type: 'info',
        time: f.arr,
        title: HOLD_REPORT_TITLE.notAllowed,
        text: `Deine Wache bei ${t.name} [1:2:6] kehrt zurück: ${HOLD_REASON_TEXT.bond}.`,
      },
    ]);
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([]);
  });

  it('starts holding at a place that has no planet any more, there is no host in vacation to ask', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
    const f: Fleet = {
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_9_9',
      toC: { g: 1, s: 9, p: 9 },
      mission: 'hold',
      ships: { lf: 3 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now() - 10,
      arr: ctx.now(),
      ret: ctx.now() + 3_600_010,
      state: 'out',
      recalled: false,
      fuel: 4,
      hold: 3_600_000,
    };
    ctx.fleets.save(f);
    expect(ctx.planets.get('p1_9_9')).toBeNull();
    onArrive(ctx, f);
    expect(ctx.fleets.get('f1')).toEqual({ ...f, state: 'hold' });
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
  });
});
