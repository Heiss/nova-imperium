import { describe, expect, it } from 'vitest';
import { planet } from '../test/fixtures.ts';
import { labUpgrading, waitsForLab } from './lab.ts';

const upgrade = (key: string) =>
  planet({ bq: { key, lvl: 1, start: 0, end: 9, cost: [0, 0, 0] } });
const researching = {
  rq: { key: 'energy', lvl: 1, start: 0, end: 9, cost: [0, 0, 0] as const },
};

describe('lab lock', () => {
  it('stops research while the lab, and only the lab, is upgraded', () => {
    expect(labUpgrading(upgrade('lab'))).toBe(true);
    expect(labUpgrading(upgrade('yard'))).toBe(false);
    expect(labUpgrading(planet())).toBe(false);
  });
  it('makes a lab upgrade, and only that, wait for running research', () => {
    expect(waitsForLab(researching, 'lab')).toBe(true);
    expect(waitsForLab(researching, 'metal')).toBe(false);
    expect(waitsForLab({ rq: null }, 'lab')).toBe(false);
  });
});
