import { describe, expect, it } from 'vitest';
import { settle } from '../../core/settle.ts';
import { DEFAULT_UNIVERSE, UNIVERSE_SPECS } from '../../core/universe.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { announce, reset, saveSettings } from './admin.ts';
import { runAction } from './dispatch.ts';
import { placePlanet } from './planets.ts';
import { isProtected, pointsMap } from './points.ts';
import { foreignView, stateFor } from './state.ts';

describe('admin', () => {
  it('only the admin changes settings or starts a round', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    expect(() => saveSettings(ctx, u, { settings: DEFAULT_UNIVERSE })).toThrow(
      'Nur der Admin',
    );
    expect(() => reset(ctx, u, {})).toThrow('Nur der Admin');
  });

  it('settles planets with the old speed before the new one applies', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { admin: true });
    addPlanet(ctx, u.id, { res: { m: 0, c: 0, d: 0 } });
    ctx.clock.t += 3600000;
    expect(
      saveSettings(ctx, u, { settings: { ...DEFAULT_UNIVERSE, speed: 10 } }),
    ).toBe('Einstellungen gespeichert.');
    expect(ctx.admin.universe().speed).toBe(10);
    expect(ctx.planets.home(u.id)!.res.m).toBe(100);
    expect(ctx.planets.home(u.id)!.t).toBe(ctx.now());
  });

  it('settles a Fusionskraftwerk with the Energietechnik of its owner (#47)', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { admin: true, research: { energy: 9 } });
    const src = addPlanet(ctx, u.id, {
      b: { deut: 9, fusion: 6, metal: 12 },
      res: { m: 0, c: 0, d: 50000 },
    });
    ctx.clock.t += 3600000;
    saveSettings(ctx, u, { settings: { ...DEFAULT_UNIVERSE, speed: 10 } });
    const want = settle(src, ctx.now(), DEFAULT_UNIVERSE, u);
    expect(ctx.planets.home(u.id)!.res).toEqual(want.res);
    expect(want.res.m).toBeGreaterThan(
      settle(src, ctx.now(), DEFAULT_UNIVERSE).res.m,
    );
  });

  it('refuses invalid settings with all errors and changes nothing', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { admin: true });
    addPlanet(ctx, u.id, { g: 2, s: 40, p: 5 });
    expect(() =>
      saveSettings(ctx, u, {
        settings: { ...DEFAULT_UNIVERSE, galaxies: 1, speed: 0 },
      }),
    ).toThrow(
      'Tempo (Faktor): ganze Zahl von 1 bis 100. Galaxien: mindestens 2, dort liegen schon Planeten.',
    );
    expect(() => saveSettings(ctx, u, {})).toThrow('Tempo');
    expect(ctx.admin.universe()).toEqual(DEFAULT_UNIVERSE);
  });

  it('a new round gives everybody a fresh planet and clears research, fleets and reports', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna', {
      admin: true,
      research: { energy: 3 },
      readAt: 9,
    });
    const b = addUser(ctx, 'Bert');
    addPlanet(ctx, a.id, { b: { metal: 9 } });
    ctx.reports.add(b.id, { id: 'r', time: 1, type: 'info', title: 't' }, 60);
    expect(reset(ctx, a, {})).toContain('Neue Runde');
    expect(ctx.players.get(a.id)).toMatchObject({
      research: {},
      rq: null,
      readAt: 0,
      admin: true,
    });
    expect(ctx.planets.home(a.id)!.b).toEqual({});
    expect(ctx.planets.home(b.id)).not.toBeNull();
    expect(ctx.reports.ofPlayer(b.id)).toEqual([]);
  });

  it('a new round gives each player a Heimatplanet in a random galaxy', () => {
    for (const [r, g] of [
      [0, 1],
      [0.999, 2],
    ] as const) {
      const ctx = { ...testCtx(), rng: () => r };
      const a = addUser(ctx, 'Anna', { admin: true });
      reset(ctx, a, {});
      expect(ctx.planets.home(a.id)).toMatchObject({ name: 'Heimatplanet', g });
    }
  });

  it('a new round clears the Trümmerfelder (#45)', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna', { admin: true });
    ctx.debris.add({ g: 1, s: 2, p: 3 }, { m: 1800, c: 600 });
    reset(ctx, a, {});
    expect(ctx.debris.all()).toEqual([]);
  });

  it('a new round forgets the surveyed positions (#190)', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna', { admin: true });
    const c = { g: 1, s: 2, p: 3 };
    ctx.surveys.add({ id: 'v1', ...c, temp: 50, diameter: 9000, created: 1 });
    reset(ctx, a, {});
    expect(ctx.surveys.get(c)).toBeNull();
  });

  it('a new round ends the planets without a field limit (#51)', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna', { admin: true });
    addPlanet(ctx, a.id, { unlimited: true, diameter: 15000 });
    reset(ctx, a, {});
    expect(ctx.planets.home(a.id)).toMatchObject({
      diameter: 12800,
      unlimited: false,
    });
  });

  it('saves the extra fields per planet with the other settings (#51)', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { admin: true });
    saveSettings(ctx, u, {
      settings: { ...DEFAULT_UNIVERSE, extraFields: 30 },
    });
    expect(ctx.admin.universe().extraFields).toBe(30);
    expect(() =>
      saveSettings(ctx, u, {
        settings: { ...DEFAULT_UNIVERSE, extraFields: 101 },
      }),
    ).toThrow('Zusatzfelder pro Planet: ganze Zahl von 0 bis 100.');
    expect(ctx.admin.universe().extraFields).toBe(30);
  });
});

// The messages of `universeErrors` (#214): the server words each code as the
// check in src/core did before, every refused setting at once.
describe('the messages of refused settings (#214)', () => {
  /** The message of the settings, or null when they are saved. */
  function refusal(
    settings: Record<string, unknown>,
    at: { g: number; s: number; p: number } = { g: 1, s: 10, p: 12 },
  ): string | null {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { admin: true });
    addPlanet(ctx, u.id, at);
    try {
      saveSettings(ctx, u, { settings });
      return null;
    } catch (e) {
      expect(ctx.admin.universe()).toEqual(DEFAULT_UNIVERSE);
      return (e as Error).message;
    }
  }

  it('names the range of a value outside it', () => {
    expect(refusal({ ...DEFAULT_UNIVERSE, speed: 0 })).toBe(
      'Tempo (Faktor): ganze Zahl von 1 bis 100.',
    );
    expect(refusal({ ...DEFAULT_UNIVERSE, extraFields: 101 })).toBe(
      'Zusatzfelder pro Planet: ganze Zahl von 0 bis 100.',
    );
    for (const endzeitMinutes of [0, 4321, 1.5])
      expect(refusal({ ...DEFAULT_UNIVERSE, endzeitMinutes })).toBe(
        'Flugzeit der Endzeit-Gabe (Minuten): ganze Zahl von 1 bis 4320.',
      );
  });

  it('names the coordinate a size may not shrink below', () => {
    expect(
      refusal(
        { ...DEFAULT_UNIVERSE, galaxies: 1, systems: 39, positions: 13 },
        { g: 2, s: 40, p: 14 },
      ),
    ).toBe(
      'Galaxien: mindestens 2, dort liegen schon Planeten. Systeme je Galaxie: mindestens 40, dort liegen schon Planeten. Positionen je System: mindestens 14, dort liegen schon Planeten.',
    );
  });

  it('says every refused setting at once, in the order of the form', () => {
    expect(refusal({})).toBe(
      UNIVERSE_SPECS.map(
        (s) => `${s.label}: ganze Zahl von ${s.min} bis ${s.max}.`,
      ).join(' '),
    );
    expect(refusal({ ...DEFAULT_UNIVERSE })).toBeNull();
  });
});

describe('placing planets', () => {
  it('uses the start resources and a free position 4 to 12', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.admin.saveUniverse({
      ...DEFAULT_UNIVERSE,
      startMetal: 7,
      startCrystal: 8,
      startDeuterium: 9,
    });
    const p = placePlanet(ctx, 'u_Anna', 'X', 2);
    expect(p).toMatchObject({
      owner: 'u_Anna',
      name: 'X',
      g: 2,
      res: { m: 7, c: 8, d: 9 },
      t: ctx.now(),
      created: ctx.now(),
      // A home planet has 163 fields (#51).
      diameter: 12800,
      unlimited: false,
    });
    expect(p.p).toBeGreaterThanOrEqual(4);
    expect(p.p).toBeLessThanOrEqual(12);
    expect(p.temp).toBeGreaterThanOrEqual(130 - (p.p - 1) * 10 - 10);
    expect(p.temp).toBeLessThanOrEqual(130 - (p.p - 1) * 10 + 10);
    expect(ctx.planets.get(p.id)).toEqual(p);
  });
  it('falls back to the first free spot and fails when the universe is full', () => {
    const ctx = { ...testCtx(), rng: () => 0 };
    addUser(ctx, 'Anna');
    ctx.admin.saveUniverse({
      ...DEFAULT_UNIVERSE,
      galaxies: 1,
      systems: 1,
      positions: 12,
    });
    expect(placePlanet(ctx, 'u_Anna', 'a', 1).p).toBe(4);
    expect(placePlanet(ctx, 'u_Anna', 'b', 1).p).toBe(1);
    for (let i = 0; i < 10; i++) placePlanet(ctx, 'u_Anna', `c${i}`, 1);
    expect(() => placePlanet(ctx, 'u_Anna', 'd', 1)).toThrow(
      'Das Universum ist voll.',
    );
  });
});

describe('points and state', () => {
  it('count buildings, research, units and fleets per 1,000', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 1 } });
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Anna', {
      b: { metal: 1 },
      ships: { lf: 1 },
      def: { rl: 1 },
    });
    ctx.fleets.save({
      id: 'f',
      owner: 'u_Anna',
      from: 'a',
      fromC: { g: 1, s: 1, p: 1 },
      to: 'b',
      toC: { g: 1, s: 1, p: 2 },
      mission: 'attack',
      ships: { bs: 1, xx: 1 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: 0,
      arr: 9e12,
      ret: 9e12,
      state: 'out',
      recalled: false,
      fuel: 0,
    });
    // energy 1200 + metal 75 + lf 4000 + rl 2000 + bs 60000 = 67275
    expect(pointsMap(ctx)).toEqual({ u_Anna: 67, u_Bert: 0 });
    expect(isProtected('u_Anna', 'u_Bert', { u_Anna: 5, u_Bert: 1 })).toBe(
      false,
    );
    expect(isProtected('u_Anna', 'u_Bert', { u_Anna: 6, u_Bert: 1 })).toBe(
      true,
    );
    expect(isProtected('u_Anna', 'x', {})).toBe(false);
  });

  it('count Schlachtkreuzer and Zerstörer by their cost (#58, #59)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { ships: { bc: 2, dr: 1 } });
    // bc 2 × 85,000 + dr 125,000 = 295,000
    expect(pointsMap(ctx)).toEqual({ u_Anna: 295 });
  });

  it('count the new defense by its cost (#50)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { def: { ionc: 3, pt: 1, ssd: 1, lsd: 1 } });
    // ionc 3 × 8,000 + pt 130,000 + ssd 20,000 + lsd 100,000 = 274,000
    expect(pointsMap(ctx)).toEqual({ u_Anna: 274 });
  });

  it('count the Bomber by its cost (#57)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { ships: { bb: 2, dr: 1 } });
    // bb 2 × 90,000 + dr 125,000 = 305,000
    expect(pointsMap(ctx)).toEqual({ u_Anna: 305 });
  });

  it('count the Todesstern by its cost (#60)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { ships: { dstar: 1, bb: 1 } });
    // dstar 10,000,000 + bb 90,000 = 10,090,000
    expect(pointsMap(ctx)).toEqual({ u_Anna: 10090 });
  });

  it('shows own fleets fully and incoming foreign ones partly', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Bert', { admin: true });
    addPlanet(ctx, a.id, { g: 1, s: 1, p: 5 });
    addPlanet(ctx, b.id, { g: 1, s: 2, p: 5 });
    const base = {
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_2_5',
      toC: { g: 1, s: 2, p: 5 },
      cargo: { m: 5, c: 0, d: 0 },
      dep: 0,
      arr: 9e12,
      ret: 9e12,
      recalled: false,
      fuel: 0,
    };
    ctx.fleets.save({
      ...base,
      id: 'f1',
      owner: a.id,
      mission: 'transport',
      ships: { sc: 1 },
      state: 'out',
    });
    ctx.fleets.save({
      ...base,
      id: 'f2',
      owner: a.id,
      mission: 'attack',
      ships: { lf: 1 },
      state: 'out',
    });
    ctx.fleets.save({
      ...base,
      id: 'f3',
      owner: a.id,
      mission: 'attack',
      ships: { lf: 1 },
      state: 'back',
    });
    const sa = stateFor(ctx, a) as {
      fleets: unknown[];
      admin: unknown;
      cfg: unknown;
    };
    expect(sa.fleets).toHaveLength(3);
    expect(sa.admin).toBeNull();
    expect(sa.cfg).toEqual(DEFAULT_UNIVERSE);
    const sb = stateFor(ctx, b) as {
      fleets: Record<string, unknown>[];
      admin: { specs: unknown[] };
      players: unknown;
      galaxy: unknown[];
      me: unknown;
    };
    expect(sb.fleets.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(sb.fleets[0]).toEqual(foreignView(ctx.fleets.get('f1')!));
    expect(sb.fleets[0]!.ships).toEqual({});
    expect(sb.fleets[0]!.cargo).toBeUndefined();
    expect(sb.fleets[1]!.ships).toEqual({ lf: 1 });
    expect(sb.admin.specs.length).toBeGreaterThan(0);
    expect(sb.players).toEqual({
      u_Anna: { name: 'Anna', points: 12 },
      u_Bert: { name: 'Bert', points: 0 },
    });
    expect(sb.galaxy).toHaveLength(2);
    expect(sb.me).toEqual({
      id: b.id,
      name: 'Bert',
      research: {},
      rq: null,
      probes: 1,
      explain: 'icon',
      pushOff: [],
      readAt: 0,
      admin: true,
    });
  });

  it('works for a player without planet', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    expect((stateFor(ctx, a) as { planet: unknown }).planet).toBeNull();
  });
});

describe('a server message (announce)', () => {
  const tooLong = new Error(
    'Bitte eine Nachricht mit höchstens 500 Zeichen eingeben.',
  );

  it('takes a text of up to 500 characters, not counting the spaces around it', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    expect(announce(ctx, 'x'.repeat(500))).toBe(1);
    expect(announce(ctx, `  ${'y'.repeat(500)}  `)).toBe(1);
    expect(ctx.reports.ofPlayer(a.id).map((r) => r.text)).toEqual(
      expect.arrayContaining(['x'.repeat(500), 'y'.repeat(500)]),
    );
  });

  it('refuses a longer text, no text and a blank one, and sends nothing', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    expect(() => announce(ctx, 'z'.repeat(501))).toThrow(tooLong);
    for (const input of [42, null, undefined, ['Hallo']])
      expect(() => announce(ctx, input)).toThrow(tooLong);
    expect(() => announce(ctx, ' \n ')).toThrow(
      new Error('Bitte eine Nachricht eingeben.'),
    );
    expect(ctx.reports.ofPlayer(a.id)).toEqual([]);
  });
});

describe('dispatch', () => {
  it('runs known actions after the due fleets, in one transaction', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    addPlanet(ctx, a.id, { res: { m: 1000, c: 1000, d: 0 } });
    expect(runAction(ctx, a.id, { type: 'build', key: 'metal' })).toBeNull();
    expect(() => runAction(ctx, a.id, { type: 'build', key: 'metal' })).toThrow(
      'bereits gebaut',
    );
    expect(() => runAction(ctx, a.id, { type: 'hack' })).toThrow(
      'Unbekannte Aktion.',
    );
    expect(() => runAction(ctx, a.id, { type: 'constructor' })).toThrow(
      'Unbekannte Aktion.',
    );
    expect(() => runAction(ctx, 'gone', { type: 'read' })).toThrow(
      'Bitte einloggen.',
    );
  });
});
