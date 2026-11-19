// The points of the highscore (#78, #288).
import { describe, expect, it } from 'vitest';
import { POINT_COST, pointsOf } from './points.ts';

describe('points', () => {
  it('count one point per 1,000 resources, rounded down', () => {
    expect(POINT_COST).toBe(1000);
    expect(pointsOf(0)).toBe(0);
    expect(pointsOf(999)).toBe(0);
    expect(pointsOf(1000)).toBe(1);
    expect(pointsOf(1999)).toBe(1);
    expect(pointsOf(123456)).toBe(123);
  });
});
