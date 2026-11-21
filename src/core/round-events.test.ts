// The rules of the events of a running round (#235): the research that
// finished and the cost of finished units.
import { describe, expect, it } from 'vitest';
import { UNIT } from './catalog.ts';
import { researchFinished, unitsCost, unitsPaid } from './round-events.ts';

const q = (over: object = {}) => ({
  key: 'energy',
  lvl: 3,
  start: 100,
  end: 500,
  cost: [1, 2, 3] as const,
  ...over,
});

describe('researchFinished', () => {
  const prev = { research: { energy: 2 }, rq: q() };

  it('names the research that was due and is in the saved levels', () => {
    expect(researchFinished(prev, { research: { energy: 3 } }, 500)).toEqual({
      key: 'energy',
      lvl: 3,
      end: 500,
      cost: [1, 2, 3],
    });
    expect(researchFinished(prev, { research: { energy: 4 } }, 900)).not.toBe(
      null,
    );
  });

  it('is null without a running research', () => {
    expect(
      researchFinished(
        { research: {}, rq: null },
        { research: { energy: 3 } },
        500,
      ),
    ).toBeNull();
  });

  it('is null before its end, to the millisecond', () => {
    expect(researchFinished(prev, { research: { energy: 3 } }, 499)).toBeNull();
    expect(
      researchFinished(prev, { research: { energy: 3 } }, 500),
    ).not.toBeNull();
  });

  it('is null when the saved levels lack it, to the level', () => {
    expect(researchFinished(prev, { research: { energy: 2 } }, 500)).toBeNull();
    expect(researchFinished(prev, { research: {} }, 500)).toBeNull();
    expect(researchFinished(prev, { research: { other: 9 } }, 500)).toBeNull();
  });
});

describe('unitsCost', () => {
  it('adds the catalog cost of each unit times its number', () => {
    const [a, b] = [UNIT.rl!, UNIT.lt!];
    expect(unitsCost({ rl: 2, lt: 3 })).toEqual([
      a.cost[0] * 2 + b.cost[0] * 3,
      a.cost[1] * 2 + b.cost[1] * 3,
      a.cost[2] * 2 + b.cost[2] * 3,
    ]);
    expect(unitsCost({})).toEqual([0, 0, 0]);
  });

  it('ignores a key that is not in the catalog', () => {
    expect(unitsCost({ nope: 5 })).toEqual([0, 0, 0]);
  });
});

describe('unitsPaid', () => {
  it('lists ships and defense apart and only what finished', () => {
    expect(unitsPaid({}, {})).toBeUndefined();
    expect(unitsPaid({ lt: 1 }, {})).toEqual({ ships: [...UNIT.lt!.cost] });
    expect(unitsPaid({}, { rl: 1 })).toEqual({ def: [...UNIT.rl!.cost] });
    expect(unitsPaid({ lt: 1 }, { rl: 1 })).toEqual({
      ships: [...UNIT.lt!.cost],
      def: [...UNIT.rl!.cost],
    });
  });
});
