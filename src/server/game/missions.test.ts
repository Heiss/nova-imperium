// The contract of every mission on the server (owner, 2026-11-14, #116): each
// mission in the generated index has its arrival in the server index, and
// the dispatcher, the return, the coming home, the view of the defender and
// the cargo follow its typed rules. A new mission is checked here without
// new test code; its own behaviour is tested in its folder.
import { describe, expect, it } from 'vitest';
import { MISSION_SERVERS } from '../../features/index.server.gen.ts';
import { MISSIONS } from '../../features/index.gen.ts';
import type { MissionRules, TargetKind } from '../../core/missions.ts';
import type { Coords, Fleet, Mission } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { arrive, comeHome } from './arrival.ts';
import { send } from './fleet-actions.ts';
import { foreignView } from './state.ts';

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
};
const MISFITS: Record<TargetKind, Coords[]> = {
  own: [FOREIGN, FREE],
  foreign: [COLONY, FREE],
  any: [FREE],
  free: [COLONY, FOREIGN],
};

const id = (c: Coords): string => `p${c.g}_${c.s}_${c.p}`;

function setup() {
  const ctx = testCtx();
  const anna = addUser(ctx, 'Anna');
  // Points from research, so the noob protection does not shield him.
  addUser(ctx, 'Bert', { research: { energy: 10 } });
  addPlanet(ctx, anna.id, {
    ...HOME,
    ships: { sc: 5, colony: 5, probe: 5 },
  });
  addPlanet(ctx, anna.id, { ...COLONY, name: 'Kolonie' });
  addPlanet(ctx, 'u_Bert', { ...FOREIGN, name: 'Beta' });
  return { ctx, anna };
}

function fleet(
  ctx: ReturnType<typeof testCtx>,
  mission: Mission,
  to: Coords,
): Fleet {
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: id(HOME),
    fromC: HOME,
    to: id(to),
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

  it.each(RULES)('%s: turns back from a target that no longer fits', (m, r) => {
    for (const to of MISFITS[r.target]) {
      const { ctx } = setup();
      const before = ctx.planets.all();
      arrive(ctx, fleet(ctx, m, to));
      expect(ctx.fleets.get('f1')?.state, `${m} ${id(to)}`).toBe('back');
      expect(ctx.planets.all()).toEqual(before);
      expect(ctx.reports.ofPlayer('u_Anna').map((x) => x.title)).toEqual([
        'Flotte kehrt um',
      ]);
    }
  });

  it.each(RULES)(
    '%s: flies back after the arrival only if it returns',
    (m, r) => {
      const { ctx } = setup();
      arrive(ctx, fleet(ctx, m, FITS[r.target]));
      expect(ctx.fleets.get('f1')?.state ?? 'gone', m).toBe(
        r.returns ? 'back' : 'gone',
      );
    },
  );

  it.each(RULES)('%s: comes home with a report unless silent', (m, r) => {
    for (const recalled of [false, true]) {
      const { ctx } = setup();
      const f = fleet(ctx, m, FITS[r.target]);
      comeHome(ctx, { ...f, state: 'back', recalled });
      const reports = ctx.reports.ofPlayer('u_Anna').map((x) => x.title);
      expect(reports.length, `${m} recalled ${recalled}`).toBe(
        r.silent && !recalled ? 0 : 1,
      );
      expect(ctx.fleets.get('f1')).toBeNull();
    }
  });

  it.each(RULES)(
    '%s: shows the ships to the defender only if visible',
    (m, r) => {
      const { ctx } = setup();
      const f = fleet(ctx, m, FOREIGN);
      expect(foreignView(f).ships).toEqual(r.visible ? f.ships : {});
    },
  );

  it.each(RULES)('%s: takes the cargo only if it carries cargo', (m, r) => {
    const sent: Fleet[] = [];
    for (const ships of [{ sc: 1, colony: 1 }, { probe: 1 }]) {
      const { ctx, anna } = setup();
      try {
        send(ctx, anna, {
          planet: id(HOME),
          ships,
          to: FITS[r.target],
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

  it('treats a fleet of an unknown mission like before: no ships shown, a report at home', () => {
    const { ctx } = setup();
    const f = {
      ...fleet(ctx, 'transport', FOREIGN),
      mission: 'nope',
    } as unknown as Fleet;
    expect(foreignView(f).ships).toEqual({});
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
      arrive(ctx, fleet(ctx, 'colonize', to));
      expect(ctx.planets.get(id(to)) !== null, id(to)).toBe(fits);
    }
    const { ctx } = setup();
    const far = { g: 3, s: 1, p: 1 };
    addPlanet(ctx, 'u_Bert', { ...far, name: 'Fern' });
    arrive(ctx, fleet(ctx, 'transport', far));
    expect(ctx.reports.ofPlayer('u_Anna')[0]!.title).toBe(
      'Transport erreicht [3:1:1]',
    );
  });

  it('refuses to land a fleet of an unknown mission', () => {
    const { ctx } = setup();
    const f = { ...fleet(ctx, 'transport', FOREIGN), mission: 'nope' };
    expect(() => arrive(ctx, f as unknown as Fleet)).toThrow(
      'Unknown mission nope',
    );
  });
});
