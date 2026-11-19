import { describe, expect, it } from 'vitest';
import {
  placeCounts,
  playtimeMs,
  playtimePayload,
  rankRows,
  type ReportRow,
  resourceSum,
  roundDays,
  standingOf,
} from './round-report.ts';

const row = (
  seat: number,
  total: number,
  over: Partial<ReportRow> = {},
): ReportRow => ({
  seat,
  name: `P${seat}`,
  you: false,
  valuation: { total, buildings: seat, research: 0, fleet: 0, defense: 0 },
  economy: { m: 0, c: 0, d: 0 },
  planets: 1,
  moons: 0,
  guild: null,
  ...over,
});

describe('rankRows', () => {
  it('sorts by the points, best first, and equal points by the seat', () => {
    const rows = [row(1, 10), row(2, 30), row(3, 10), row(4, 30)];
    expect(rankRows(rows).map((r) => r.seat)).toEqual([2, 4, 1, 3]);
  });

  it('sorts by another category and leaves its input alone', () => {
    const rows = [row(1, 99), row(2, 1), row(3, 50)];
    expect(rankRows(rows, 'buildings').map((r) => r.seat)).toEqual([3, 2, 1]);
    expect(rows.map((r) => r.seat)).toEqual([1, 2, 3]);
  });

  it('is empty for no rows', () => {
    expect(rankRows([])).toEqual([]);
  });
});

describe('standingOf', () => {
  it('gives the rank among all rows with the points', () => {
    const rows = [row(1, 10), row(2, 30), row(3, 20)];
    expect(standingOf(rows, 3)).toEqual({ rank: 2, of: 3, points: 20 });
    expect(standingOf(rows, 2)).toEqual({ rank: 1, of: 3, points: 30 });
  });

  it('is null for a seat that is not in the round', () => {
    expect(standingOf([row(1, 10)], 7)).toBeNull();
    expect(standingOf([], 1)).toBeNull();
  });
});

describe('the small helpers', () => {
  it('sums the three resources without weights', () => {
    expect(resourceSum({ m: 1, c: 20, d: 300 })).toBe(321);
  });

  it('counts a round in whole days, at least one', () => {
    const day = 86400000;
    expect(roundDays(0, 0)).toBe(1);
    expect(roundDays(0, day)).toBe(1);
    expect(roundDays(0, day + 1)).toBe(2);
    expect(roundDays(day, 31 * day)).toBe(30);
    expect(roundDays(10, 5)).toBe(1);
  });

  it('counts planets and moons of the places', () => {
    expect(
      placeCounts([{ kind: 'planet' }, { kind: 'moon' }, { kind: 'planet' }]),
    ).toEqual({ planets: 2, moons: 1 });
    expect(placeCounts([])).toEqual({ planets: 0, moons: 0 });
  });
});

describe('the play time payload of the archive (#235 × #232)', () => {
  const at = (start: number, end: number, method = 1) => ({
    start,
    end,
    method,
  });

  it('merges overlapping and touching intervals, so two pages count once', () => {
    const p = playtimePayload(
      [at(0, 100), at(50, 150), at(150, 200), at(300, 400)],
      1000,
    );
    expect(p.intervals).toEqual([
      [0, 200],
      [300, 400],
    ]);
    expect(playtimeMs(p)).toBe(300);
  });

  it('orders the intervals and names each method once', () => {
    const p = playtimePayload(
      [at(300, 400, 2), at(0, 100, 1), at(500, 600, 2)],
      1000,
    );
    expect(p.intervals.map(([a]) => a)).toEqual([0, 300, 500]);
    expect(p.methods).toEqual([1, 2]);
  });

  it('cuts at the cutoff and drops what starts after it or lasts no time', () => {
    const p = playtimePayload(
      [at(0, 100), at(900, 1200), at(1000, 1100), at(1500, 1600), at(50, 50)],
      1000,
    );
    expect(p.intervals).toEqual([
      [0, 100],
      [900, 1000],
    ]);
  });

  it('is a measured zero without time: empty lists', () => {
    expect(playtimePayload([], 1000)).toEqual({ methods: [], intervals: [] });
    expect(playtimeMs({ methods: [], intervals: [] })).toBe(0);
  });
});
