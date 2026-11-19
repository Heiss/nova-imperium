// Wache stellen (#55): its typed data, its own check (an ally with room at
// the planet) and its arrival, which starts the holding.
import { describe, expect, it } from 'vitest';
import type { SendTarget } from '../../../core/missions.ts';
import type { Fleet } from '../../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';
import { texts } from './texts.de.ts';

const fleet = { owner: 'a', from: 'p1', ships: { lf: 1 } };

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

  it('starts holding at its arrival and writes no report', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
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
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([]);
  });
});
