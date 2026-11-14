// Moons (#53): a new moon from the moon step of a battle or from the admin's
// „Mond anlegen“ (seeded random, fixed clock).
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { addMoon, createMoon, MOON_NAME, moonAt, rollMoon } from './moons.ts';

function setup() {
  const ctx = testCtx(1_000_000, 42);
  addUser(ctx, 'Bert');
  const t = addPlanet(ctx, 'u_Bert', {
    g: 1,
    s: 2,
    p: 6,
    name: 'Beta',
    temp: 77,
  });
  return { ctx, t };
}

/** A random generator that returns the given draws in turn. */
const draws = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++] ?? 0.5;
};

describe('a new moon', () => {
  it('belongs to the owner of its planet, with its temperature, as „Mond“ without stock', () => {
    const { ctx, t } = setup();
    ctx.rng = draws(0);
    const moon = addMoon(ctx, t, 1, 5000);
    expect(MOON_NAME).toBe('Mond');
    expect(moon).toEqual({
      id: 'm1_2_6',
      kind: 'moon',
      owner: 'u_Bert',
      name: 'Mond',
      g: 1,
      s: 2,
      p: 6,
      temp: 77,
      diameter: 3605,
      unlimited: false,
      res: { m: 0, c: 0, d: 0 },
      b: {},
      ships: {},
      def: {},
      bq: null,
      sq: [],
      sqT: null,
      pct: {},
      t: 5000,
      created: 5000,
    });
    expect(ctx.planets.get('m1_2_6')).toEqual(moon);
    expect(moonAt(ctx, t)).toEqual(moon);
    // The planet stays as it was.
    expect(ctx.planets.get('p1_2_6')).toEqual(t);
  });

  it('takes its diameter from the chance', () => {
    const { ctx, t } = setup();
    ctx.rng = draws(0.9999);
    expect(addMoon(ctx, t, 20, 0).diameter).toBe(8944);
  });

  it('is found only at its own position', () => {
    const { ctx, t } = setup();
    expect(moonAt(ctx, t)).toBeNull();
    addMoon(ctx, t, 5, 0);
    expect(moonAt(ctx, { g: 1, s: 2, p: 7 })).toBeNull();
    expect(moonAt(ctx, { g: 1, s: 2, p: 6 })!.id).toBe('m1_2_6');
  });
});

describe('the moon step of a battle', () => {
  it('rolls nothing without a Trümmerfeld or below 100,000', () => {
    const { ctx, t } = setup();
    let n = 0;
    ctx.rng = () => (n++, 0);
    expect(rollMoon(ctx, t, 0)).toBeNull();
    ctx.debris.add(t, { m: 60000, c: 39999 });
    expect(rollMoon(ctx, t, 0)).toBeNull();
    expect(n).toBe(0);
    expect(moonAt(ctx, t)).toBeNull();
  });

  it('rolls the chance of the whole field once and forms the moon on a hit', () => {
    const { ctx, t } = setup();
    ctx.debris.add(t, { m: 1_000_000, c: 250_000 });
    ctx.rng = draws(0.1199, 0);
    expect(rollMoon(ctx, t, 7000)).toEqual({ moonChance: 12, moon: true });
    const moon = moonAt(ctx, t)!;
    expect(moon.created).toBe(7000);
    expect(moon.diameter).toBe(Math.floor(Math.sqrt(10 + 36) * 1000));
  });

  it('leaves no moon on a miss, and says so', () => {
    const { ctx, t } = setup();
    ctx.debris.add(t, { m: 1_000_000, c: 250_000 });
    let n = 0;
    ctx.rng = () => (n++, 0.12);
    expect(rollMoon(ctx, t, 0)).toEqual({ moonChance: 12, moon: false });
    expect(n).toBe(1);
    expect(moonAt(ctx, t)).toBeNull();
  });

  it('caps the chance at 20 %', () => {
    const { ctx, t } = setup();
    ctx.debris.add(t, { m: 5e9, c: 5e9 });
    ctx.rng = draws(0.5);
    expect(rollMoon(ctx, t, 0)).toEqual({ moonChance: 20, moon: false });
  });

  it('rolls nothing at a planet that has a moon, or at a moon', () => {
    const { ctx, t } = setup();
    ctx.debris.add(t, { m: 5e9, c: 5e9 });
    const moon = addMoon(ctx, t, 5, 0);
    let n = 0;
    ctx.rng = () => (n++, 0);
    expect(rollMoon(ctx, t, 0)).toBeNull();
    expect(rollMoon(ctx, moon, 0)).toBeNull();
    expect(n).toBe(0);
    expect(ctx.planets.all().filter((x) => x.kind === 'moon')).toHaveLength(1);
  });

  it('counts the field at the position of the planet only', () => {
    const { ctx, t } = setup();
    ctx.debris.add({ g: 1, s: 2, p: 7 }, { m: 5e9, c: 5e9 });
    expect(rollMoon(ctx, t, 0)).toBeNull();
  });
});

describe('„Mond anlegen“ by the admin', () => {
  const entry = (): AuditEntry => ({ category: 'admin.write', action: 'x' });

  it('always creates the moon; the chance only gives the diameter', () => {
    const { ctx } = setup();
    ctx.clock.t = 9000;
    ctx.rng = draws(0.9999);
    const e = entry();
    const moon = createMoon(ctx, { planet: 'p1_2_6', chance: 20 }, e);
    expect(moon).toMatchObject({
      id: 'm1_2_6',
      owner: 'u_Bert',
      diameter: 8944,
      created: 9000,
    });
    expect(e).toEqual({
      category: 'admin.write',
      action: 'x',
      target: 'u_Bert',
      detail: {
        planet: 'p1_2_6',
        moon: 'm1_2_6',
        chance: 20,
        diameter: 8944,
      },
    });
  });

  it('takes a chance of 1 to 20 %, whole', () => {
    for (const chance of [1, '7', 20]) {
      const { ctx } = setup();
      expect(createMoon(ctx, { planet: 'p1_2_6', chance }, entry()).id).toBe(
        'm1_2_6',
      );
    }
    for (const chance of [0, 21, 2.5, -1, 'x', null, undefined]) {
      const { ctx } = setup();
      expect(() =>
        createMoon(ctx, { planet: 'p1_2_6', chance }, entry()),
      ).toThrow('Die Mondchance muss zwischen 1 und 20 % liegen.');
      expect(moonAt(ctx, { g: 1, s: 2, p: 6 })).toBeNull();
    }
  });

  it('refuses a planet that has a moon, a moon and an unknown planet', () => {
    const { ctx, t } = setup();
    addMoon(ctx, t, 5, 0);
    const e = entry();
    expect(() => createMoon(ctx, { planet: 'p1_2_6', chance: 5 }, e)).toThrow(
      'Dieser Planet hat schon einen Mond.',
    );
    expect(e.target).toBe('u_Bert');
    for (const planet of ['m1_2_6', 'p9_9_9', '', undefined, 42]) {
      const f = entry();
      expect(() => createMoon(ctx, { planet, chance: 5 }, f)).toThrow(
        'Planet nicht gefunden.',
      );
      expect(f.target).toBeUndefined();
    }
  });
});
