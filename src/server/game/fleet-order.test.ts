import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { recall, send } from './fleet-actions.ts';

// The refusals of `send` and `recall` that the server checks beside
// `sendError`, and the order of all their checks (#214), pinned before the
// checks move into src/core.

function setup() {
  const ctx = testCtx();
  // Auspex-Lehre 1 lets Anna spy (#175); no Kogitator-Doktrin: one slot.
  const a = addUser(ctx, 'Anna', { research: { spy: 1 } });
  const b = addUser(ctx, 'Bert');
  const home = addPlanet(ctx, a.id, {
    g: 1,
    s: 1,
    p: 5,
    ships: { lf: 10, sc: 2, probe: 3, sat: 4 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  // Bert has enough points (metal mine 15) not to be under noob protection.
  addPlanet(ctx, b.id, { g: 1, s: 2, p: 6, b: { metal: 15 } });
  return { ctx, a, b, home };
}

const go = (over = {}) => ({
  mission: 'attack',
  ships: { lf: 2 },
  to: { g: 1, s: 2, p: 6 },
  pct: 10,
  cargo: {},
  ...over,
});

/** The message `send` is refused with, or its answer. */
function sent(
  ctx: ReturnType<typeof setup>['ctx'],
  a: Parameters<typeof send>[1],
  d: object,
): string {
  try {
    return String(send(ctx, a, go(d) as never));
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

const UNKNOWN = 'error: Unbekannter Auftrag.';
const STATIONARY = 'error: Sonnenreliquiare können nicht fliegen.';
const NO_SHIPS = 'error: Keine Schiffe ausgewählt.';
const NO_PROBES = 'error: Keine Spähschädel auf dem Planeten.';
const SLOTS = 'error: Alle Flottenslots belegt.';
const NO_PLANET = 'error: An dieser Position gibt es keinen Planeten.';
const HOLD = 'error: Nicht genug Laderaum.';
const FUEL = 'error: Nicht genug Promethium für Treibstoff und Ladung.';
const NOWHERE = { g: 2, s: 2, p: 2 };

/** Fills the one fleet slot of Anna. */
function fillSlots(
  ctx: ReturnType<typeof setup>['ctx'],
  a: Parameters<typeof send>[1],
): void {
  expect(sent(ctx, a, {})).toContain('unterwegs');
}

describe('send', () => {
  it('refuses an unknown mission and a mission of the silo before the ships', () => {
    const { ctx, a } = setup();
    fillSlots(ctx, a);
    for (const mission of ['unknown', 'missile', '', undefined])
      for (const ships of [{}, { sat: 2 }, { lf: 1 }])
        expect(sent(ctx, a, { mission, ships, to: NOWHERE })).toBe(UNKNOWN);
  });

  it('then refuses a ship that cannot fly, before an empty choice and the slots', () => {
    const { ctx, a } = setup();
    fillSlots(ctx, a);
    expect(sent(ctx, a, { ships: { sat: 2 }, to: NOWHERE })).toBe(STATIONARY);
    expect(sent(ctx, a, { ships: { lf: 1, sat: 1 }, to: NOWHERE })).toBe(
      STATIONARY,
    );
  });

  it('then refuses no ships before the slots', () => {
    const { ctx, a } = setup();
    fillSlots(ctx, a);
    for (const ships of [{}, null, { lf: 0 }, { bs: 3 }, { toString: 3 }])
      expect(sent(ctx, a, { ships, to: NOWHERE })).toBe(NO_SHIPS);
  });

  // F12 (owner, 2026-11-21): the text of the Sternenkarte; until then the
  // server answered „Keine Schiffe ausgewählt.“
  it('refuses an Auspex-Erkundung without probes as the Sternenkarte does', () => {
    const { ctx, a } = setup();
    for (const ships of [{}, { probe: 0 }])
      expect(sent(ctx, a, { mission: 'spy', ships })).toBe(NO_PROBES);
    fillSlots(ctx, a);
    expect(sent(ctx, a, { mission: 'spy', ships: {}, to: NOWHERE })).toBe(
      NO_PROBES,
    );
  });

  it('then refuses all slots used before the target', () => {
    const { ctx, a } = setup();
    fillSlots(ctx, a);
    expect(sent(ctx, a, { to: NOWHERE })).toBe(SLOTS);
    expect(sent(ctx, a, { mission: 'spy', ships: { probe: 1 } })).toBe(SLOTS);
  });

  it('then the target, before the holding time, the stay, the hold and the fuel', () => {
    const { ctx, a } = setup();
    expect(sent(ctx, a, { mission: 'hold', to: NOWHERE })).toBe(NO_PLANET);
    expect(
      sent(ctx, a, { mission: 'transport', cargo: { d: 1e9 }, to: NOWHERE }),
    ).toBe(NO_PLANET);
  });

  it('then the hold before the fuel', () => {
    const { ctx, a, home } = setup();
    ctx.planets.save({ ...home, res: { ...home.res, d: 0 } });
    expect(
      sent(ctx, a, {
        mission: 'transport',
        ships: { lf: 1 },
        cargo: { d: 1e6 },
      }),
    ).toBe(HOLD);
    expect(
      sent(ctx, a, {
        mission: 'transport',
        ships: { sc: 1 },
        cargo: { d: 100 },
      }),
    ).toBe(FUEL);
    expect(sent(ctx, a, { ships: { lf: 1 } })).toBe(FUEL);
    expect(ctx.fleets.all()).toEqual([]);
  });
});

const GONE = 'error: Rückruf nicht mehr möglich.';
const GIFT = 'error: Die Gabe des Gottkaisers kann nicht zurückgerufen werden.';
const BACK = 'Flotte zurückgerufen.';

describe('recall', () => {
  /** Saves a flight of Anna with the changes and answers its recall by `who`. */
  function recalled(over: Partial<Fleet>, who: 'a' | 'b' = 'a'): string {
    const { ctx, a, b, home } = setup();
    const t = ctx.now();
    ctx.fleets.save({
      id: 'f1',
      owner: a.id,
      from: home.id,
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_2_6',
      toC: { g: 1, s: 2, p: 6 },
      mission: 'attack',
      ships: { lf: 1 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: t - 1000,
      arr: t + 1000,
      ret: t + 3000,
      state: 'out',
      recalled: false,
      fuel: 0,
      ...over,
    });
    try {
      return String(recall(ctx, who === 'a' ? a : b, { id: 'f1' }));
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
  }

  it('takes an own fleet on the way out until its arrival, not at it', () => {
    const t = testCtx().now();
    expect(recalled({})).toBe(BACK);
    expect(recalled({ arr: t + 1 })).toBe(BACK);
    expect(recalled({ arr: t })).toBe(GONE);
    expect(recalled({ arr: t - 1 })).toBe(GONE);
    expect(recalled({}, 'b')).toBe(GONE);
    expect(recalled({ state: 'back' })).toBe(GONE);
  });

  it('takes a fleet that holds until the end of its holding time', () => {
    const t = testCtx().now();
    const holds = { mission: 'hold', state: 'hold', arr: t - 500 } as const;
    expect(recalled({ ...holds, hold: 501 })).toBe(BACK);
    expect(recalled({ ...holds, hold: 500 })).toBe(GONE);
  });

  it('refuses an unknown fleet', () => {
    const { ctx, a } = setup();
    for (const id of ['nope', undefined, ''])
      expect(() => recall(ctx, a, { id })).toThrow(
        /^Rückruf nicht mehr möglich\.$/,
      );
  });

  it('refuses the gift after the other checks, and missiles as gone', () => {
    const t = testCtx().now();
    expect(recalled({ gift: true, mission: 'deploy' })).toBe(GIFT);
    expect(recalled({ gift: true, mission: 'missile' })).toBe(GIFT);
    expect(recalled({ gift: true, arr: t })).toBe(GONE);
    expect(recalled({ gift: true }, 'b')).toBe(GONE);
    expect(recalled({ mission: 'missile', ships: { ipm: 1 } })).toBe(GONE);
  });
});
