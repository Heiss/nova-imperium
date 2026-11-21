// The level table shared by the lists and the Lexicanum (#187, #285): the
// rows of the levels, their cost and time from the formulas of the core,
// the own level marked, and the same numbers as the next level of a list.
import { describe, expect, it } from 'vitest';
import { BUILD, RES } from '../../core/catalog.ts';
import { buildTime, lvlCost, researchTime } from '../../core/economy.ts';
import { U } from '../../test/fixtures.ts';
import { levelView } from '../../test/level-view.ts';
import { catalogPage } from './catalog-list.ts';
import { dur } from './format.ts';
import {
  deltaText,
  effectText,
  type LevelEffect,
  levelOf,
  levelRow,
  levelTable,
} from './level-table.ts';

const view = levelView;

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
    const t = levelTable(v, 'computer', [
      { label: 'Slots', at: (l) => l * 2, unit: 'x' },
    ])!;
    expect(t.timeLabel).toBe('Forschungszeit');
    expect(t.effects).toEqual([{ label: 'Slots', unit: 'x' }]);
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
    expect(t.rows.map((r) => r.values[0])).toEqual([6, 8, 10, 12, 20, 30, 40]);
  });

  it('starts with level 1 when the entry has no level yet', () => {
    const t = levelTable(view(), 'metal')!;
    expect(t.timeLabel).toBe('Bauzeit');
    expect(t.effects).toEqual([]);
    expect(t.rows[0]).toMatchObject({ level: 1, current: false, values: [] });
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

describe('the effects of the table (#187)', () => {
  const tens: LevelEffect = { label: 'Wert', at: (l) => l * 10 };
  const use: LevelEffect = { label: 'Bedarf', at: (l) => l * l, cost: true };

  it('gives every row each value and its difference to the own level', () => {
    const t = levelTable(view({ b: { metal: 3 } }), 'metal', [tens, use], {
      own: false,
    })!;
    expect(t.effects).toEqual([
      { label: 'Wert' },
      { label: 'Bedarf', cost: true },
    ]);
    expect(t.rows.map((r) => r.level)).toEqual([4, 5, 6, 10, 15, 20]);
    expect(t.rows[0]).toMatchObject({ values: [40, 16], deltas: [10, 7] });
    expect(t.rows[5]).toMatchObject({ values: [200, 400], deltas: [170, 391] });
  });

  it('shows only the levels to come without the own level, the own level with it', () => {
    const v = view({ b: { metal: 3 } });
    expect(
      levelTable(v, 'metal', [tens], { own: false })!.rows[0],
    ).toMatchObject({ level: 4, current: false });
    const withOwn = levelTable(v, 'metal', [tens], { own: true })!;
    expect(withOwn.rows[0]).toMatchObject({
      level: 3,
      current: true,
      values: [30],
      deltas: [0],
    });
    expect(levelTable(v, 'metal', [tens])!.rows).toEqual(withOwn.rows);
  });

  it('marks the first of the big steps, after the next 3 levels (D1)', () => {
    const big = (key: string, level: number, research = {}) =>
      levelTable(view({ b: { [key]: level } }, research), key, [], {
        own: false,
      })!.rows.flatMap((r) => (r.big ? [r.level] : []));
    expect(big('metal', 3)).toEqual([10]);
    expect(big('metal', 0)).toEqual([5]);
    expect(big('metal', 16)).toEqual([20]);
    expect(big('metal', 17)).toEqual([25]);
    expect(big('metal', 22)).toEqual([30]);
    // The own level is no big step.
    const own = levelTable(view({ b: { metal: 3 } }), 'metal')!;
    expect(own.rows.filter((r) => r.big).map((r) => r.level)).toEqual([10]);
  });

  it('has an empty value list for an entry without an effect', () => {
    const t = levelTable(view(), 'metal', [], { own: false })!;
    expect(t.effects).toEqual([]);
    for (const row of t.rows)
      expect(row).toMatchObject({ values: [], deltas: [] });
  });
});

describe('effectText and deltaText', () => {
  it('shows a number, a number with a unit, a percentage and a factor', () => {
    expect(effectText(1234.9, {})).toBe('1.234');
    expect(effectText(12, { unit: 'Systeme' })).toBe('12 Systeme');
    expect(effectText(0.4, { format: 'percent' })).toBe('+40 %');
    expect(effectText(0.5, { format: 'factor' })).toBe('×0,5');
    expect(effectText(1 / 3, { format: 'factor' })).toBe('×0,33');
    expect(effectText(1, { format: 'factor' })).toBe('×1');
  });

  it('shows the difference to today with its sign', () => {
    expect(deltaText(280.7, {})).toBe('+280');
    expect(deltaText(-19, {})).toBe('−19');
    expect(deltaText(3000, {})).toBe('+3.000');
    expect(deltaText(0.1, { format: 'percent' })).toBe('+10 %');
    expect(deltaText(-0.3, { format: 'percent' })).toBe('−30 %');
    expect(deltaText(-0.25, { format: 'factor' })).toBe('−0,25');
    expect(deltaText(0.5, { format: 'factor' })).toBe('+0,5');
  });

  it('shows nothing when nothing changes', () => {
    expect(deltaText(0, {})).toBeUndefined();
    expect(deltaText(0.4, {})).toBeUndefined();
    expect(deltaText(-0.9, {})).toBeUndefined();
    expect(deltaText(0, { format: 'percent' })).toBeUndefined();
    expect(deltaText(0.004, { format: 'percent' })).toBeUndefined();
    expect(deltaText(0.004, { format: 'factor' })).toBeUndefined();
    expect(deltaText(0, { format: 'factor' })).toBeUndefined();
  });
});
