// The jump through the Warp-Tor on the server (#53, #230; owner, 2026-11-13
// and 2026-11-16): from the active moon to another own moon with a ready
// Warp-Tor, the picked ships only and no resources, both gates cooling down
// by the level of the starting gate, stored with the moons; every refusal
// changes nothing.
import { describe, expect, it } from 'vitest';
import { gateCooldownMs } from '../../core/jump-gate.ts';
import type { Fleet, Planet } from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { ACTIONS, runAction } from './dispatch.ts';
import { heldAt } from './holding.ts';
import { JUMP_ERROR, gateState } from './jump-gate.ts';
import { addMoon } from './moons.ts';
import { stateFor } from './state.ts';

const FROM = 'm1_2_3';
const TO = 'm2_5_9';

/**
 * Anna with two planets and their moons: [1:2:3] with a Warp-Tor of level
 * `from` and ships, [2:5:9] with a Warp-Tor of level `to`; Bert with a moon
 * and a Warp-Tor at [1:7:7].
 */
function world(from = 1, to = 1) {
  const ctx = testCtx();
  const anna = addUser(ctx, 'Anna', { research: { hyper: 7 } });
  const moonOf = (owner: string, g: number, s: number, p: number) =>
    addMoon(ctx, addPlanet(ctx, owner, { g, s, p }), 10, ctx.now());
  const save = (moon: Planet, over: Partial<Planet>) =>
    ctx.planets.save({ ...moon, ...over });
  save(moonOf(anna.id, 1, 2, 3), {
    b: { moonbase: 1, jumpgate: from },
    ships: { lc: 10, bs: 2, sat: 5 },
    res: { m: 1000, c: 2000, d: 3000 },
  });
  save(moonOf(anna.id, 2, 5, 9), {
    b: { moonbase: 1, jumpgate: to },
    ships: { lc: 1 },
  });
  addUser(ctx, 'Bert');
  save(moonOf('u_Bert', 1, 7, 7), { b: { moonbase: 1, jumpgate: 1 } });
  return { ctx, anna };
}

type Ctx = ReturnType<typeof world>['ctx'];

const jump = (ctx: Ctx, data: Record<string, unknown>, event?: AuditEntry) =>
  runAction(
    ctx,
    'u_Anna',
    { type: 'jump', planet: FROM, to: TO, ships: { lc: 4 }, ...data },
    event,
  );

const ships = (ctx: Ctx, id: string) => ctx.planets.get(id)!.ships;

/** The cooldown of a gate at `level` in the universe of `ctx`. */
const cooldown = (ctx: Ctx, level: number) =>
  gateCooldownMs(level, ctx.admin.universe());

describe('the jump through the Warp-Tor', () => {
  it('is an action', () => {
    expect(Object.keys(ACTIONS)).toContain('jump');
  });

  it('moves the picked ships at once and leaves the resources', () => {
    const { ctx } = world();
    expect(jump(ctx, { ships: { lc: 4, bs: 2 } })).toBeNull();
    expect(ships(ctx, FROM)).toEqual({ lc: 6, sat: 5 });
    expect(ships(ctx, TO)).toEqual({ lc: 5, bs: 2 });
    expect(ctx.planets.get(FROM)!.res).toEqual({ m: 1000, c: 2000, d: 3000 });
    expect(ctx.planets.get(TO)!.res).toEqual({ m: 0, c: 0, d: 0 });
    // No flight: no fleet and no fuel.
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('moves at most the ships on the moon and ignores what is no ship', () => {
    const { ctx } = world();
    jump(ctx, { ships: { lc: 99, rl: 3, nope: 1, bs: -1 } });
    expect(ships(ctx, FROM)).toEqual({ bs: 2, sat: 5 });
    expect(ships(ctx, TO)).toEqual({ lc: 11 });
  });

  it('cools both gates down by the level of the starting gate', () => {
    for (const [from, to] of [
      [1, 15],
      [15, 1],
      [7, 3],
    ] as const) {
      const { ctx } = world(from, to);
      jump(ctx, {});
      const ready = ctx.now() + cooldown(ctx, from);
      expect(ctx.planets.gateReady(FROM), `${from}`).toBe(ready);
      expect(ctx.planets.gateReady(TO), `${from}`).toBe(ready);
    }
  });

  it('divides the minutes by the universe speed (owner, 2026-11-17)', () => {
    for (const [speed, ms] of [
      [1, 3_600_000],
      [7, 514_286],
    ] as const) {
      const { ctx } = world(1);
      ctx.admin.saveUniverse({ ...ctx.admin.universe(), speed });
      jump(ctx, {});
      expect(ctx.planets.gateReady(FROM), `${speed}`).toBe(ctx.now() + ms);
      expect(ctx.planets.gateReady(TO), `${speed}`).toBe(ctx.now() + ms);
    }
  });

  it('refuses a second jump until a gate is ready again, in both directions', () => {
    const { ctx } = world(2, 1);
    jump(ctx, {});
    expect(() => jump(ctx, {})).toThrow(JUMP_ERROR.cooling);
    expect(() => jump(ctx, { planet: TO, to: FROM, ships: { lc: 1 } })).toThrow(
      JUMP_ERROR.cooling,
    );
    // 53 minutes for level 2 over the speed; one millisecond before, the
    // gate still cools.
    ctx.clock.t += cooldown(ctx, 2) - 1;
    expect(() => jump(ctx, {})).toThrow(JUMP_ERROR.cooling);
    ctx.clock.t += 1;
    expect(jump(ctx, { ships: { lc: 1 } })).toBeNull();
    expect(ships(ctx, TO)).toEqual({ lc: 6 });
  });

  it('moves no ship that another player holds at the moon: the fleets that hold stay and keep defending (#55)', () => {
    const { ctx } = world();
    const held: Fleet = {
      id: 'h1',
      owner: 'u_Bert',
      from: 'm1_7_7',
      fromC: { g: 1, s: 7, p: 7 },
      to: FROM,
      toC: { g: 1, s: 2, p: 3 },
      mission: 'hold',
      ships: { lc: 50, bs: 7 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now() - 1000,
      arr: ctx.now() - 500,
      ret: ctx.now() + 3_600_000,
      state: 'hold',
      recalled: false,
      fuel: 1,
      hold: 3_600_000,
    };
    ctx.fleets.save(held);
    // More than the moon has: only the moon's own ships move.
    expect(jump(ctx, { ships: { lc: 99, bs: 99 } })).toBeNull();
    expect(ships(ctx, FROM)).toEqual({ sat: 5 });
    expect(ships(ctx, TO)).toEqual({ lc: 11, bs: 2 });
    expect(ctx.fleets.all()).toEqual([held]);
    expect(heldAt(ctx, FROM)).toEqual([held]);
    expect(heldAt(ctx, TO)).toEqual([]);
  });

  it('refuses a target whose gate cools down', () => {
    const { ctx } = world();
    ctx.planets.setGateReady(TO, ctx.now() + 1);
    expect(() => jump(ctx, {})).toThrow(JUMP_ERROR.targetCooling);
    expect(ctx.planets.gateReady(FROM)).toBe(0);
  });

  it('refuses every other case and changes nothing', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ planet: 'p1_2_3' }, JUMP_ERROR.notMoon],
      [{ to: 'm1_7_7' }, JUMP_ERROR.noTarget],
      [{ to: 'p2_5_9' }, JUMP_ERROR.noTarget],
      [{ to: 'm9_9_9' }, JUMP_ERROR.noTarget],
      [{ to: 'nonsense' }, JUMP_ERROR.noTarget],
      [{ to: undefined }, JUMP_ERROR.noTarget],
      [{ to: FROM }, JUMP_ERROR.sameMoon],
      [{ ships: {} }, JUMP_ERROR.noShips],
      [{ ships: null }, JUMP_ERROR.noShips],
      [{ ships: { sat: 2 } }, JUMP_ERROR.stationary],
    ];
    for (const [data, msg] of cases) {
      const { ctx } = world();
      const before = ctx.planets.all();
      expect(() => jump(ctx, data), msg).toThrow(msg);
      expect(ctx.planets.all()).toEqual(before);
      expect(ctx.planets.gateReady(FROM)).toBe(0);
      expect(ctx.planets.gateReady(TO)).toBe(0);
    }
  });

  it('refuses with the confirmed texts (owner, 2026-11-17)', () => {
    expect(JUMP_ERROR).toEqual({
      notMoon: 'Ein Sprung ist nur von einem Mond aus möglich.',
      noGate: 'Auf diesem Mond steht kein Warp-Tor.',
      cooling: 'Das Warp-Tor kühlt noch ab.',
      noTarget: 'Der Zielmond muss ein eigener Mond sein.',
      sameMoon: 'Start und Zielmond sind derselbe Mond.',
      targetNoGate: 'Auf dem Zielmond steht kein Warp-Tor.',
      targetCooling: 'Das Warp-Tor des Zielmonds kühlt noch ab.',
      noShips: 'Keine Schiffe ausgewählt.',
      stationary: 'Sonnenreliquiare können nicht springen.',
    });
  });

  it('needs a Warp-Tor on both moons', () => {
    const { ctx } = world(1, 0);
    expect(() => jump(ctx, {})).toThrow(JUMP_ERROR.targetNoGate);
    const other = world(0, 1).ctx;
    expect(() => jump(other, {})).toThrow(JUMP_ERROR.noGate);
  });

  it('jumps only from an own place', () => {
    const { ctx } = world();
    expect(() => jump(ctx, { planet: 'm1_7_7' })).toThrow(
      'Du hast keinen Zugriff auf diesen Planeten.',
    );
  });

  it('cannot jump to a moon that is gone (#95)', () => {
    const { ctx } = world();
    ctx.db.prepare('DELETE FROM planets WHERE id = ?').run(TO);
    expect(() => jump(ctx, {})).toThrow(JUMP_ERROR.noTarget);
  });

  it('keeps the cooldown after a restart: it is stored with the moons', () => {
    const { ctx } = world(3);
    jump(ctx, {});
    const again = testCtx(ctx.now() + 60_000, 1, ctx.db);
    expect(() =>
      runAction(again, 'u_Anna', {
        type: 'jump',
        planet: TO,
        to: FROM,
        ships: { lc: 1 },
      }),
    ).toThrow(JUMP_ERROR.cooling);
    expect(gateState(again, 'u_Anna')).toEqual([
      { id: FROM, level: 3, ready: ctx.now() + cooldown(ctx, 3) },
      { id: TO, level: 1, ready: ctx.now() + cooldown(ctx, 3) },
    ]);
  });

  it('settles the target moon before the ships arrive', () => {
    const { ctx } = world();
    const order = { key: 'lc', n: 2, unit: 1000 };
    ctx.planets.save({
      ...ctx.planets.get(TO)!,
      b: { moonbase: 1, jumpgate: 1, yard: 1 },
      sq: [order],
      sqT: ctx.now(),
    });
    ctx.clock.t += 1500;
    jump(ctx, {});
    expect(ctx.planets.get(TO)).toMatchObject({
      ships: { lc: 6 },
      sq: [{ key: 'lc', n: 1 }],
    });
  });

  it('shows a Warp-Tor finished since the last save, without saving (review of #293)', () => {
    const { ctx, anna } = world(1, 1);
    const end = ctx.now() + 1000;
    ctx.planets.save({
      ...ctx.planets.get(TO)!,
      bq: { key: 'jumpgate', lvl: 2, start: ctx.now(), end, cost: [0, 0, 0] },
    });
    expect(stateFor(ctx, anna).gates).toEqual([
      { id: FROM, level: 1, ready: 0 },
      { id: TO, level: 1, ready: 0 },
    ]);
    ctx.clock.t = end;
    expect(stateFor(ctx, anna).gates).toEqual([
      { id: FROM, level: 1, ready: 0 },
      { id: TO, level: 2, ready: 0 },
    ]);
    // The state only reads: the stored moon still has its order.
    expect(ctx.planets.get(TO)).toMatchObject({
      b: { jumpgate: 1 },
      bq: { key: 'jumpgate', lvl: 2, end },
    });
  });

  it('names the moons and the ships in the audit event', () => {
    const { ctx } = world();
    const event = { detail: {} } as AuditEntry;
    jump(ctx, { ships: { lc: 2, bs: 1 } }, event);
    expect(event.detail).toEqual({
      planet: FROM,
      target: TO,
      ships: { lc: 2, bs: 1 },
    });
  });

  it('shows the own Warp-Tore in the state, not foreign ones', () => {
    const { ctx, anna } = world(4, 2);
    expect(stateFor(ctx, anna).gates).toEqual([
      { id: FROM, level: 4, ready: 0 },
      { id: TO, level: 2, ready: 0 },
    ]);
    jump(ctx, {});
    expect(stateFor(ctx, anna).gates).toEqual([
      { id: FROM, level: 4, ready: ctx.now() + cooldown(ctx, 4) },
      { id: TO, level: 2, ready: ctx.now() + cooldown(ctx, 4) },
    ]);
    expect(stateFor(ctx, ctx.players.get('u_Bert')!).gates).toEqual([
      { id: 'm1_7_7', level: 1, ready: 0 },
    ]);
  });
});
