import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { recall, send } from './fleet-actions.ts';

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
    const p = ctx.store.planetOfUser(a.id)!;
    expect(p.ships.sc).toBe(1);
    expect(p.res).toEqual({ m: 49000, c: 38000, d: 30000 - 500 - 4 });
    const f = ctx.store.fleets()[0]!;
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
    expect(ctx.store.fleets()[0]!.ships).toEqual({ lf: 10, probe: 3 });
    // The cargo is limited to the stock first: 50,000 metal do not fit into 500.
    a.research = { computer: 1 };
    ctx.store.saveUser(a);
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
    expect(() => send(ctx, a, go({ mission: 'colonize' }))).toThrow(
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
    ).toThrow('nur mit Spionagesonden');
    expect(() =>
      send(
        ctx,
        a,
        go({ mission: 'transport', ships: { lf: 1 }, cargo: { m: 51 } }),
      ),
    ).toThrow('Laderaum');
    addPlanet(ctx, a.id, { g: 1, s: 3, p: 3, created: 2e6 });
    expect(() => send(ctx, a, go({ to: { g: 1, s: 3, p: 3 } }))).toThrow(
      'Eigene Planeten',
    );
    void b;
  });
  it('needs deuterium for fuel and cargo', () => {
    const { ctx, a } = setup();
    const p = ctx.store.planetOfUser(a.id)!;
    p.res.d = 5;
    ctx.store.savePlanet(p);
    expect(() => send(ctx, a, go())).toThrow('Nicht genug Deuterium');
  });
  it('respects the fleet slots', () => {
    const { ctx, a } = setup();
    send(ctx, a, go());
    expect(() => send(ctx, a, go())).toThrow('Alle Flottenslots belegt.');
    a.research = { computer: 1 };
    ctx.store.saveUser(a);
    expect(send(ctx, a, go())).toContain('unterwegs');
  });
  it('protects small players but allows transports to them', () => {
    const { ctx, a, b } = setup();
    const p = ctx.store.planetOfUser(a.id)!;
    p.b = { metal: 30 };
    ctx.store.savePlanet(p);
    expect(() => send(ctx, a, go())).toThrow('Noobschutz');
    expect(send(ctx, a, go({ mission: 'transport' }))).toContain('unterwegs');
    void b;
  });
});

describe('recall', () => {
  it('turns the fleet around; the way back takes as long as the way out so far', () => {
    const { ctx, a } = setup();
    send(ctx, a, go());
    const f = ctx.store.fleets()[0]!;
    ctx.clock.t += 1000;
    expect(recall(ctx, a, { id: f.id })).toBe('Flotte zurückgerufen.');
    expect(ctx.store.fleet(f.id)).toMatchObject({
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
    const f = ctx.store.fleets()[0]!;
    expect(() => recall(ctx, b, { id: f.id })).toThrow('Rückruf');
    expect(() => recall(ctx, a, { id: 'x' })).toThrow('Rückruf');
    ctx.clock.t = f.arr;
    expect(() => recall(ctx, a, { id: f.id })).toThrow('Rückruf');
  });
});
