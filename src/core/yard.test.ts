import { describe, expect, it } from 'vitest';
import { planet } from '../test/fixtures.ts';
import {
  hasYard,
  limitRoom,
  orderMax,
  siloRoom,
  siloUse,
  unitRoom,
  waitsForYard,
  YARD_HOME,
  YARD_LOCK,
  yardLockedBy,
} from './yard.ts';

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

describe('the buildings of the shipyard lock (#183)', () => {
  it('are the Werft and the Nanitenfabrik, named short in a message', () => {
    expect(YARD_LOCK).toEqual({
      yard: 'Schiffsschmiede',
      nanite: 'Machina-Schwarmhalle',
    });
    expect(YARD_HOME).toBe('yard');
  });
  it('make the building that is the shipyard the one ships and defense need', () => {
    expect(hasYard(planet({ b: { yard: 1 } }))).toBe(true);
    expect(hasYard(planet({ b: { nanite: 4 } }))).toBe(false);
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

describe('missiles in the silo (#54)', () => {
  const rich = { m: 1e9, c: 1e9, d: 1e9 };

  it('counts the places of the silo and those the missiles take, stock and queue', () => {
    expect(siloUse(planet())).toEqual({ used: 0, places: 0 });
    expect(
      siloUse(
        planet({
          b: { silo: 3 },
          def: { abm: 4, ipm: 2, rl: 50 },
          sq: [
            { key: 'ipm', n: 3, unit: 1 },
            { key: 'abm', n: 1, unit: 1 },
            { key: 'rl', n: 9, unit: 1 },
          ],
        }),
      ),
    ).toEqual({ used: 4 + 4 + 6 + 1, places: 30 });
  });

  it('leaves a missile the room of its free places, any other unit without bound', () => {
    const p = planet({ b: { silo: 2 }, def: { abm: 5, ipm: 3 } });
    // 20 places, 11 taken: 9 Abfangraketen or 4 Orbitalraketen.
    expect(siloRoom(p, 'abm')).toBe(9);
    expect(siloRoom(p, 'ipm')).toBe(4);
    expect(siloRoom(planet(), 'abm')).toBe(0);
    for (const k of ['rl', 'ssd', 'lf', 'nope', 'constructor'])
      expect(siloRoom(p, k), k).toBe(Infinity);
    // Over-full (a silo torn down later): no room, never below 0.
    expect(siloRoom(planet({ b: { silo: 1 }, def: { ipm: 9 } }), 'abm')).toBe(
      0,
    );
  });

  it('takes the smaller of the limit and the silo room, also for the largest order', () => {
    const p = planet({ res: rich, b: { silo: 1 }, def: { abm: 2 } });
    expect(limitRoom(p, 'abm')).toBe(Infinity);
    expect(unitRoom(p, 'abm')).toBe(8);
    expect(unitRoom(p, 'ipm')).toBe(4);
    expect(orderMax(p, 'abm')).toBe(8);
    expect(
      orderMax(
        planet({ res: { m: 16000, c: 0, d: 1e9 }, b: { silo: 1 } }),
        'abm',
      ),
    ).toBe(2);
    expect(unitRoom(planet({ def: { ssd: 1 } }), 'ssd')).toBe(0);
    expect(limitRoom(planet(), 'lsd')).toBe(1);
  });
});

describe('a shipyard on the place', () => {
  it('is there from level 1', () => {
    expect(hasYard(planet())).toBe(false);
    expect(hasYard(planet({ b: { yard: 0 } }))).toBe(false);
    expect(hasYard(planet({ b: { yard: 1 } }))).toBe(true);
    expect(hasYard(planet({ b: { lab: 3 } }))).toBe(false);
  });
});
