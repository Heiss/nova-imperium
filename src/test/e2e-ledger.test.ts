// The areas the E2E helpers hand out (e2e/ledger.ts, #302): a new round puts
// the home planet of every player on a random position of any galaxy, also
// into an area no test has been handed yet (CI run 45028074164: the home of
// the next test was taken, review of #347). Such an area is passed over.
import { describe, expect, it } from 'vitest';
import { areaAt, firstEmptyArea } from '../../e2e/ledger.ts';

describe('the next area of an E2E test', () => {
  it('is the next one when it is empty', () => {
    expect(firstEmptyArea(5, () => [])).toEqual({
      area: areaAt(5),
      passed: [],
    });
  });

  it('passes over an area where a new round put a planet, and names it', () => {
    const at = (n: number, ds: number, p: number): string =>
      `${areaAt(n).g}:${areaAt(n).s + ds}:${p}`;
    const taken = new Map([
      [5, [at(5, 0, 4)]],
      [6, [at(6, 0, 9), at(6, 1, 5)]],
    ]);
    const result = firstEmptyArea(5, (a) => taken.get(a.n) ?? []);
    expect(result.area).toEqual(areaAt(7));
    expect(result.passed).toEqual([
      { area: areaAt(5), planets: [at(5, 0, 4)] },
      { area: areaAt(6), planets: [at(6, 0, 9), at(6, 1, 5)] },
    ]);
  });
});
