import { describe, expect, it } from 'vitest';
import { planet } from '../test/fixtures.ts';
import { orderMax, unitRoom, waitsForYard, yardLockedBy } from './yard.ts';

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

describe('units once per planet (#50)', () => {
  const rich = { m: 1e9, c: 1e9, d: 1e9 };
  it('leave room for one dome of each kind', () => {
    expect(unitRoom(planet(), 'ssd')).toBe(1);
    expect(unitRoom(planet(), 'lsd')).toBe(1);
    expect(unitRoom(planet({ def: { ssd: 1 } }), 'ssd')).toBe(0);
    expect(unitRoom(planet({ def: { ssd: 1 } }), 'lsd')).toBe(1);
    expect(unitRoom(planet({ def: { lsd: 0 } }), 'lsd')).toBe(1);
  });
  it('count the domes in the shipyard queue', () => {
    const queued = planet({
      sq: [
        { key: 'rl', n: 5, unit: 1 },
        { key: 'lsd', n: 1, unit: 1 },
      ],
    });
    expect(unitRoom(queued, 'lsd')).toBe(0);
    expect(unitRoom(queued, 'ssd')).toBe(1);
    // A stored excess never turns into a negative room.
    expect(unitRoom(planet({ def: { ssd: 2 } }), 'ssd')).toBe(0);
  });
  it('leave every other unit unlimited', () => {
    for (const k of ['rl', 'ionc', 'pt', 'lf', 'sat', 'nope', 'toString'])
      expect(unitRoom(planet({ def: { [k]: 3 } }), k)).toBe(Infinity);
  });
  it('limit the largest order to what can be paid and the room', () => {
    expect(orderMax(planet({ res: rich }), 'ssd')).toBe(1);
    expect(orderMax(planet({ res: rich, def: { ssd: 1 } }), 'ssd')).toBe(0);
    expect(orderMax(planet({ res: { m: 9999, c: 1e9, d: 0 } }), 'ssd')).toBe(0);
    expect(orderMax(planet({ res: { m: 6000, c: 0, d: 0 } }), 'rl')).toBe(3);
  });
});
