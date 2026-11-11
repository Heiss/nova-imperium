import { describe, expect, it } from 'vitest';
import { planet } from '../test/fixtures.ts';
import { waitsForYard, yardLockedBy } from './yard.ts';

const upgrade = (key: string) =>
  planet({ bq: { key, lvl: 1, start: 0, end: 9, cost: [0, 0, 0] } });
const busy = planet({ sq: [{ key: 'lf', n: 1, unit: 1 }] });

describe('shipyard lock', () => {
  it('is set by an upgrade of the Werft or the Nanitenfabrik only', () => {
    expect(yardLockedBy(planet())).toBeNull();
    expect(yardLockedBy(upgrade('yard'))).toBe('yard');
    expect(yardLockedBy(upgrade('nanite'))).toBe('nanite');
    expect(yardLockedBy(upgrade('robot'))).toBeNull();
    expect(yardLockedBy(upgrade('toString'))).toBeNull();
  });
  it('makes their upgrades wait for the orders of the shipyard', () => {
    expect(waitsForYard(busy, 'yard')).toBe(true);
    expect(waitsForYard(busy, 'nanite')).toBe(true);
    expect(waitsForYard(busy, 'robot')).toBe(false);
    expect(waitsForYard(planet(), 'nanite')).toBe(false);
  });
});
