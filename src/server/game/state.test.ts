// What stateFor() shows of fleets and the home planet: own fleets in
// full, foreign fleets only on their way to the shown planet and only as
// the observer's Auspex-Lehre recognizes them (#228).
import { describe, expect, it, vi } from 'vitest';
import { RECOGNITION_DEFAULT } from '../../core/fleet-recognition.ts';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { foreignView, stateFor } from './state.ts';

const fleet = (over: Partial<Fleet>): Fleet => ({
  id: 'f',
  owner: 'u_Anna',
  from: 'p1_1_5',
  fromC: { g: 1, s: 1, p: 5 },
  to: 'p1_2_5',
  toC: { g: 1, s: 2, p: 5 },
  mission: 'transport',
  ships: { sc: 2 },
  cargo: { m: 5, c: 1, d: 0 },
  dep: 0,
  arr: 9e12,
  ret: 9e12,
  state: 'out',
  recalled: false,
  fuel: 0,
  ...over,
});

type Shown = {
  fleets: Fleet[];
  homePlanet: string | null;
  planet: { id: string } | null;
};

describe('state: fleets and the home planet', () => {
  it('shows own fleets in full and names the home planet', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const home = addPlanet(ctx, a.id, { g: 1, s: 1, p: 5 });
    const own = fleet({ id: 'own' });
    ctx.fleets.save(own);
    const s = stateFor(ctx, a) as Shown;
    expect(s.homePlanet).toBe(home.id);
    expect(s.fleets).toEqual([own]);
    expect(s.fleets[0]).not.toEqual(foreignView(own, 0, RECOGNITION_DEFAULT));
  });

  it('shows foreign fleets only on their way to the shown planet', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Bert');
    addPlanet(ctx, a.id, { g: 1, s: 1, p: 5 });
    addPlanet(ctx, b.id, { g: 1, s: 2, p: 5 });
    addPlanet(ctx, b.id, { g: 1, s: 3, p: 5 });
    const here = fleet({ id: 'here' });
    ctx.fleets.save(here);
    ctx.fleets.save(
      fleet({ id: 'elsewhere', to: 'p1_3_5', toC: { g: 1, s: 3, p: 5 } }),
    );
    ctx.fleets.save(fleet({ id: 'home', state: 'back' }));
    const s = stateFor(ctx, b, 'p1_2_5') as Shown;
    expect(s.fleets).toEqual([foreignView(here, 0, RECOGNITION_DEFAULT)]);
  });

  it('treats a selection that is not a string as no selection and never looks it up', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const home = addPlanet(ctx, a.id, { g: 1, s: 1, p: 5 });
    addPlanet(ctx, a.id, { g: 1, s: 2, p: 5 });
    // The body of an action can hold any JSON as `planet`.
    const get = vi.spyOn(ctx.planets, 'get');
    for (const selected of [
      undefined,
      null,
      5,
      true,
      {},
      { id: 'p1_2_5' },
      ['p1_2_5'],
    ]) {
      get.mockClear();
      const s = stateFor(ctx, a, selected) as Shown;
      expect(s.planet?.id, JSON.stringify(selected)).toBe(home.id);
      const looked = get.mock.calls.map(([id]) => id);
      expect(
        looked.filter((id) => typeof id !== 'string'),
        JSON.stringify(selected),
      ).toEqual([]);
    }
    // A string selection of the player's own planet is looked up and shown.
    get.mockClear();
    expect((stateFor(ctx, a, 'p1_2_5') as Shown).planet?.id).toBe('p1_2_5');
    expect(get).toHaveBeenCalledWith('p1_2_5');
  });

  it('shows a player without a planet only their own fleets', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const c = addUser(ctx, 'Cora');
    addPlanet(ctx, a.id, { g: 1, s: 1, p: 5 });
    ctx.fleets.save(fleet({ id: 'foreign' }));
    const s = stateFor(ctx, c) as Shown;
    expect(s.homePlanet).toBeNull();
    expect(s.fleets).toEqual([]);
  });

  it('shows the logical time and the reports of the player, and only theirs', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Bert');
    addPlanet(ctx, a.id, { g: 1, s: 1, p: 5 });
    ctx.reports.add(
      a.id,
      { id: 'r_a', time: 1, type: 'info', title: 'Für Anna' },
      10,
    );
    ctx.reports.add(
      b.id,
      { id: 'r_b', time: 1, type: 'info', title: 'Für Bert' },
      10,
    );
    ctx.clock.t += 12345;
    const s = stateFor(ctx, a) as { now: number; reports: { id: string }[] };
    expect(s.now).toBe(ctx.now());
    expect(s.reports.map((r) => r.id)).toEqual(['r_a']);
  });
});
