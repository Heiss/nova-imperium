// The level table shared by the lists and the Lexicanum (#187, #285): the
// rows of the levels, their cost and time from the formulas of the core,
// the own level marked, and the same numbers as the next level of a list.
import { describe, expect, it } from 'vitest';
import { BUILD, RES } from '../../core/catalog.ts';
import { buildTime, lvlCost, researchTime } from '../../core/economy.ts';
import type { Levels, Planet } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { catalogPage } from './catalog-list.ts';
import { dur } from './format.ts';
import { levelOf, levelRow, levelSteps, levelTable } from './level-table.ts';
import type { GameState } from './types.ts';

function view(P: Partial<Planet> = {}, research: Levels = {}, labs = []): V {
  return {
    s: {
      cfg: U,
      me: { id: 'u1', explain: 'icon' },
      labs,
      galaxy: [],
      mainPlanet: 'p',
    } as unknown as GameState,
    P: planet({ res: { m: 0, c: 0, d: 0 }, ...P }),
    R: { research, rq: null },
    now: 0,
    ui: { openEx: {} } as unknown as Ui,
  };
}

describe('levelSteps (#187 D1)', () => {
  it.each([
    [0, [1, 2, 3, 5, 10, 15, 20]],
    [3, [4, 5, 6, 10, 15, 20]],
    [16, [17, 18, 19, 20]],
    [17, [18, 19, 20, 25]],
    [19, [20, 21, 22, 25]],
    [20, [21, 22, 23, 25]],
    [21, [22, 23, 24, 25]],
    [22, [23, 24, 25, 30]],
    [47, [48, 49, 50, 55]],
  ])('level %i → %j', (level, steps) => {
    expect(levelSteps(level)).toEqual(steps);
  });
});

describe('levelRow and levelTable', () => {
  it('costs and times of a building come from lvlCost and buildTime', () => {
    const v = view({ b: { metal: 3, robot: 2 } });
    const row = levelRow(v, 'metal', 4)!;
    expect(row.cost).toEqual(lvlCost(BUILD.metal!, 4));
    expect(row.time).toBe(buildTime(row.cost, v.P, U));
    expect(levelOf(v, 'metal')).toBe(3);
  });

  it('research counts the linked Scholarien (#49)', () => {
    const v = view({ id: 'a', b: { lab: 2 } }, { ifn: 1 }, [
      { id: 'b', lab: 5, upgrading: false },
    ] as never);
    const row = levelRow(v, 'spy', 2)!;
    expect(row.cost).toEqual(lvlCost(RES.spy!, 2));
    expect(row.time).toBe(researchTime(row.cost, { b: { lab: 7 } }, U));
  });

  it('has no rows for an entry without levels', () => {
    expect(levelRow(view(), 'probe', 1)).toBeUndefined();
    expect(levelTable(view(), 'probe')).toBeNull();
  });

  it('marks the own level first, then the steps, with the effect', () => {
    const v = view({}, { computer: 3 });
    const t = levelTable(v, 'computer', {
      label: 'Slots',
      at: (l) => l * 2,
      unit: 'x',
    })!;
    expect(t.timeLabel).toBe('Forschungszeit');
    expect(t.effect).toEqual({ label: 'Slots', unit: 'x' });
    expect(t.rows.map((r) => r.level)).toEqual([3, 4, 5, 6, 10, 15, 20]);
    expect(t.rows.map((r) => r.current)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(t.rows.map((r) => r.effect)).toEqual([6, 8, 10, 12, 20, 30, 40]);
  });

  it('starts with level 1 when the entry has no level yet', () => {
    const t = levelTable(view(), 'metal')!;
    expect(t.timeLabel).toBe('Bauzeit');
    expect(t.effect).toBeUndefined();
    expect(t.rows[0]).toMatchObject({ level: 1, current: false });
    expect(t.rows[0]!.effect).toBeUndefined();
  });

  it('shows the same cost and time as the next level of the list', () => {
    const v = view({ b: { metal: 5, lab: 3 } }, { spy: 2 });
    for (const [kind, key] of [
      ['building', 'metal'],
      ['research', 'spy'],
    ] as const) {
      const page = catalogPage(v, kind);
      if (page.blocked) throw new Error('blocked');
      const row = page.rows.find((r) => r.key === key)!;
      const next = levelTable(v, key)!.rows[1]!;
      expect(row.cost).toEqual(next.cost);
      expect(row.lines.join(' ')).toContain(dur(next.time));
    }
  });
});
