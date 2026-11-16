// The resource bar (#118, bundle 1): what the bar shows of the planet as it
// runs, with its production per hour, its storage and the energy.
import { describe, expect, it } from 'vitest';
import type { Planet } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import { resourceBar } from './resource-bar.ts';
import type { GameState } from './types.ts';

const game = (me: object = {}): GameState =>
  ({
    cfg: U,
    me: { id: 'u1', research: {}, rq: null, ...me },
  }) as unknown as GameState;

const bar = (over: Partial<Planet>, now = 0, me?: object) =>
  resourceBar(game(me), planet(over), now);

describe('resourceBar', () => {
  it('shows the three resources with their production and storage', () => {
    expect(bar({ res: { m: 1234, c: 50, d: 0 } }).cells).toEqual([
      {
        label: 'Adamant',
        icon: 'metal',
        value: '1.234',
        full: false,
        title: '+100/h · Lager 100.000',
      },
      {
        label: 'Psikristall',
        icon: 'crystal',
        value: '50',
        full: false,
        title: '+50/h · Lager 100.000',
      },
      {
        label: 'Promethium',
        icon: 'deuterium',
        value: '0',
        full: false,
        title: '+0/h · Lager 100.000',
      },
    ]);
  });

  it('marks a full storage from its exact size on', () => {
    const cells = bar({ res: { m: 100_000, c: 99_999, d: 250_000 } }).cells;
    expect(cells.map((c) => c.full)).toEqual([true, false, true]);
  });

  it('shows a falling resource without a plus', () => {
    // The Fusionskraftwerk burns Promethium (#51).
    const title = bar({ b: { fusion: 5 }, res: { m: 0, c: 0, d: 50_000 } })
      .cells[2]!.title;
    expect(title).toMatch(/^-\d+\/h · Lager 100\.000$/);
  });

  it('moves the planet to the time of the bar', () => {
    const later = bar({ res: { m: 0, c: 0, d: 0 } }, 3_600_000);
    expect(later.planet.res).toEqual({ m: 100, c: 50, d: 0 });
    expect(later.planet.t).toBe(3_600_000);
    expect(later.cells.map((c) => c.value)).toEqual(['100', '50', '0']);
  });

  it('shows the energy left over and the energy produced', () => {
    expect(bar({}).energy).toEqual({ value: '0/0', short: false });
    expect(bar({ b: { solar: 5, metal: 3 } }).energy).toEqual({
      value: '121/161',
      short: false,
    });
    expect(bar({ b: { metal: 5 } }).energy).toEqual({
      value: '-81/0',
      short: true,
    });
  });

  it('counts research that finished before the time of the bar', () => {
    const me = {
      research: { energy: 0 },
      rq: { key: 'energy', lvl: 12, start: 0, end: 10, cost: [0, 0, 0] },
    };
    const fusion = { b: { fusion: 3, deut: 2 } };
    expect(resourceBar(game(me), planet(fusion), 9).energy.value).toBe('26/74');
    expect(resourceBar(game(me), planet(fusion), 10).energy.value).toBe(
      '54/103',
    );
  });
});
