// The contract of every mission on the server (owner, 2026-11-14, #116): each
// mission in the generated index has its arrival in the server index, and
// the dispatcher, the return, the coming home and the cargo follow its typed
// rules; the defender sees its ships by the Auspex-Lehre (#228). A new
// mission is checked here without new test code; its own behaviour is
// tested in its folder.
import { describe, expect, it } from 'vitest';
import { MISSION_SERVERS } from '../../features/index.server.gen.ts';
import { MISSIONS } from '../../features/index.gen.ts';
import {
  launchOf,
  MISSION,
  type MissionRules,
  type TargetKind,
  missionRules,
} from '../../core/missions.ts';
import { placeId } from '../../core/place.ts';
import type { Coords, Fleet, Mission } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { arrive, comeHome } from './arrival.ts';
import { send } from './fleet-actions.ts';
import { addMoon } from './moons.ts';
import { foreignView } from './state.ts';
import { RECOGNITION_DEFAULT } from '../../core/fleet-recognition.ts';

const RULES: [Mission, MissionRules][] = MISSIONS.map(([m, r]) => [m, r]);

const HOME = { g: 1, s: 1, p: 5 };
const COLONY = { g: 1, s: 1, p: 7 };
const FOREIGN = { g: 1, s: 2, p: 6 };
const FREE = { g: 1, s: 4, p: 8 };

/** A target that fits each kind, and one that does not. */
const FITS: Record<TargetKind, Coords> = {
  own: COLONY,
  foreign: FOREIGN,
  any: FOREIGN,
  free: FREE,
  // A Trümmerfeld lies at Bert's planet (#45).
  debris: FOREIGN,
  // Bert's planet has a moon (#95).
  foreignMoon: FOREIGN,
};
const MISFITS: Record<TargetKind, Coords[]> = {
  own: [FOREIGN, FREE],
  foreign: [COLONY, FREE],
  any: [FREE],
  free: [COLONY, FOREIGN],
  debris: [COLONY, FREE],
  // Anna's colony has her own moon; the free position none.
  foreignMoon: [COLONY, FREE],
};

const id = (c: Coords): string => `p${c.g}_${c.s}_${c.p}`;

/** The kind of place a target kind flies to: a Trümmerfeld (#45), a moon (#95) or a planet. */
const KIND: Partial<Record<TargetKind, 'debris' | 'moon'>> = {
  debris: 'debris',
  foreignMoon: 'moon',
};

/** The place a mission flies to: a planet, the Trümmerfeld or the moon. */
const placeOf = (m: Mission, c: Coords): string =>
  placeId({ ...c, kind: KIND[missionRules(m)!.target] ?? 'planet' });

function setup() {
  const ctx = testCtx();
  // Auspex-Lehre 1 lets Anna spy (#175, Q1), Auspex-Kartographie 1 lets her
  // survey (#190).
  const anna = addUser(ctx, 'Anna', { research: { spy: 1, carto: 1 } });
  // Points from research, so the noob protection does not shield him, also
  // from the Weltenbrecher of Anna (#95).
  addUser(ctx, 'Bert', { research: { energy: 14 } });
  addPlanet(ctx, anna.id, {
    ...HOME,
    ships: { sc: 5, colony: 5, probe: 5, recycler: 5, dstar: 5 },
  });
  const colony = addPlanet(ctx, anna.id, { ...COLONY, name: 'Kolonie' });
  const beta = addPlanet(ctx, 'u_Bert', { ...FOREIGN, name: 'Beta' });
  ctx.debris.add(FOREIGN, { m: 100, c: 50 });
  addMoon(ctx, colony, 1, ctx.now());
  addMoon(ctx, beta, 1, ctx.now());
  return { ctx, anna };
}

function fleetTo(
  ctx: ReturnType<typeof testCtx>,
  mission: Mission,
  to: Coords,
): Fleet {
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: id(HOME),
    fromC: HOME,
    to: placeOf(mission, to),
    toC: to,
    mission,
    ships: { sc: 2, colony: 1 },
    cargo: { m: 10, c: 0, d: 0 },
    dep: ctx.now() - 1000,
    arr: ctx.now(),
    ret: ctx.now() + 1000,
    state: 'out',
    recalled: false,
    fuel: 10,
  };
  ctx.fleets.save(f);
  return f;
}

describe('the server part of every mission (contract)', () => {
  it('has an arrival for every mission and none without one', () => {
    expect(MISSION_SERVERS.map(([m]) => m)).toEqual(MISSIONS.map(([m]) => m));
    for (const [m, server] of MISSION_SERVERS)
      expect(typeof server.onArrive, m).toBe('function');
  });

  it.each(RULES)(
    '%s: turns back from a target that no longer fits, missiles are lost',
    (m, r) => {
      const fleet = launchOf(r) === 'fleet';
      for (const to of MISFITS[r.target]) {
        const { ctx } = setup();
        const before = ctx.planets.all();
        arrive(ctx, fleetTo(ctx, m, to));
        expect(ctx.fleets.get('f1')?.state, `${m} ${id(to)}`).toBe(
          fleet ? 'back' : undefined,
        );
        expect(ctx.planets.all()).toEqual(before);
        expect(ctx.reports.ofPlayer('u_Anna').map((x) => x.title)).toEqual([
          fleet ? 'Flotte kehrt um' : `${MISSION[m]} [${to.g}:${to.s}:${to.p}]`,
        ]);
      }
    },
  );

  it.each(RULES)(
    '%s: flies back after the arrival only if it returns',
    (m, r) => {
      const { ctx } = setup();
      arrive(ctx, fleetTo(ctx, m, FITS[r.target]));
      expect(ctx.fleets.get('f1')?.state ?? 'gone', m).toBe(
        r.returns ? 'back' : 'gone',
      );
    },
  );

  it.each(RULES)('%s: comes home with a report unless silent', (m, r) => {
    for (const recalled of [false, true]) {
      const { ctx } = setup();
      const f = fleetTo(ctx, m, FITS[r.target]);
      comeHome(ctx, { ...f, state: 'back', recalled });
      const reports = ctx.reports.ofPlayer('u_Anna').map((x) => x.title);
      expect(reports.length, `${m} recalled ${recalled}`).toBe(
        r.silent && !recalled ? 0 : 1,
      );
      expect(ctx.fleets.get('f1')).toBeNull();
    }
  });

  it.each(RULES)(
    '%s: shows the defender its ships by the Auspex-Lehre only (#228, D2)',
    (m) => {
      const { ctx } = setup();
      const f = fleetTo(ctx, m, FOREIGN);
      expect(foreignView(f, 7, RECOGNITION_DEFAULT).ships, m).toBeUndefined();
      expect(foreignView(f, 8, RECOGNITION_DEFAULT).ships, m).toEqual(f.ships);
    },
  );

  it.each(RULES)('%s: takes the cargo only if it carries cargo', (m, r) => {
    // Missiles are never sent as a fleet (#54).
    if (r.launch === 'missiles') {
      const { ctx, anna } = setup();
      expect(() =>
        send(ctx, anna, {
          planet: id(HOME),
          ships: { sc: 1 },
          to: FITS[r.target],
          mission: m,
          pct: 10,
        }),
      ).toThrow('Unbekannter Auftrag.');
      expect(ctx.fleets.all()).toEqual([]);
      return;
    }
    const sent: Fleet[] = [];
    for (const ships of [
      { sc: 1, colony: 1, recycler: 1, dstar: 1 },
      { probe: 1 },
    ]) {
      const { ctx, anna } = setup();
      try {
        send(ctx, anna, {
          planet: id(HOME),
          ships,
          to: { ...FITS[r.target], kind: KIND[r.target] ?? 'planet' },
          mission: m,
          cargo: { m: 5, c: 0, d: 0 },
          pct: 10,
        });
      } catch {
        continue;
      }
      sent.push(ctx.fleets.all()[0]!);
    }
    expect(sent.length, m).toBeGreaterThan(0);
    for (const f of sent)
      expect(f.cargo, m).toEqual({ m: r.cargo ? 5 : 0, c: 0, d: 0 });
  });

  it('treats a fleet of an unknown mission like before: a report at home', () => {
    const { ctx } = setup();
    const f = {
      ...fleetTo(ctx, 'transport', FOREIGN),
      mission: 'nope',
    } as unknown as Fleet;
    comeHome(ctx, { ...f, state: 'back' });
    expect(ctx.reports.ofPlayer('u_Anna').map((x) => x.title)).toEqual([
      'Rückkehr zu Planet u_Anna [1:1:5]',
    ]);
  });

  it('lands a free target only inside the universe, the others anywhere', () => {
    const edge = { g: 2, s: 50, p: 15 };
    for (const [to, fits] of [
      [edge, true],
      [{ ...edge, g: 3 }, false],
      [{ ...edge, s: 51 }, false],
      [{ ...edge, p: 16 }, false],
    ] as const) {
      const { ctx } = setup();
      arrive(ctx, fleetTo(ctx, 'colonize', to));
      expect(ctx.planets.get(id(to)) !== null, id(to)).toBe(fits);
    }
    const { ctx } = setup();
    const far = { g: 3, s: 1, p: 1 };
    addPlanet(ctx, 'u_Bert', { ...far, name: 'Fern' });
    arrive(ctx, fleetTo(ctx, 'transport', far));
    expect(ctx.reports.ofPlayer('u_Anna')[0]!.title).toBe(
      'Transport erreicht [3:1:1]',
    );
  });

  it('refuses to land a fleet of an unknown mission', () => {
    const { ctx } = setup();
    const f = { ...fleetTo(ctx, 'transport', FOREIGN), mission: 'nope' };
    expect(() => arrive(ctx, f as unknown as Fleet)).toThrow(
      'Unknown mission nope',
    );
  });
});
