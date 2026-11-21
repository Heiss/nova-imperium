import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, type Achievement } from './achievements.ts';
import {
  achievementOf,
  achievementStatus,
  claimError,
  dailyError,
  reached,
} from './reward-checks.ts';

// The checks of the rewards (#214): the status of an achievement and the
// codes of the two claims, in the order of the server.

const item: Achievement = {
  id: 'buildings:metal:5',
  metric: 'buildings:metal',
  category: 'buildings',
  title: 'Test',
  target: 5,
  reward: [1, 2, 3],
};

const none = new Set<string>();

describe('reached', () => {
  it('holds from the target on, and counts missing progress as 0', () => {
    expect(reached(item, {})).toBe(false);
    expect(reached(item, { 'buildings:metal': 4 })).toBe(false);
    expect(reached(item, { 'buildings:metal': 5 })).toBe(true);
    expect(reached(item, { 'buildings:metal': 6 })).toBe(true);
    expect(reached(item, { 'buildings:crystal': 9 })).toBe(false);
    expect(reached({ ...item, target: 0 }, {})).toBe(true);
  });

  it('is the progress of its metric against its target', () => {
    fc.assert(
      fc.property(fc.nat(1000), fc.nat(1000), (target, value) => {
        expect(reached({ ...item, target }, { 'buildings:metal': value })).toBe(
          value >= target,
        );
      }),
    );
  });
});

describe('achievementStatus', () => {
  it('is claimed when taken, whatever the progress', () => {
    const claimed = new Set([item.id]);
    expect(achievementStatus(item, {}, claimed)).toBe('claimed');
    expect(achievementStatus(item, { 'buildings:metal': 9 }, claimed)).toBe(
      'claimed',
    );
  });

  it('is ready at the target and open below it', () => {
    expect(achievementStatus(item, { 'buildings:metal': 5 }, none)).toBe(
      'ready',
    );
    expect(achievementStatus(item, { 'buildings:metal': 4 }, none)).toBe(
      'open',
    );
    expect(achievementStatus(item, {}, new Set(['other']))).toBe('open');
  });

  it('is claimed exactly for a claimed id, else as reached says', () => {
    fc.assert(
      fc.property(fc.nat(10), fc.boolean(), (value, taken) => {
        const progress = { 'buildings:metal': value };
        const claimed = taken ? new Set([item.id]) : none;
        const ready = reached(item, progress) ? 'ready' : 'open';
        expect(achievementStatus(item, progress, claimed)).toBe(
          taken ? 'claimed' : ready,
        );
      }),
    );
  });
});

describe('achievementOf', () => {
  it('finds every achievement by its exact id', () => {
    for (const a of ACHIEVEMENTS) expect(achievementOf(a.id)).toBe(a);
  });

  it('finds nothing for any other value', () => {
    const first = ACHIEVEMENTS[0]!.id;
    for (const id of [
      undefined,
      null,
      '',
      'unknown',
      ` ${first}`,
      first.toUpperCase(),
      5,
    ])
      expect(achievementOf(id)).toBeUndefined();
    fc.assert(
      fc.property(fc.string(), (id) => {
        fc.pre(!ACHIEVEMENTS.some((a) => a.id === id));
        expect(achievementOf(id)).toBeUndefined();
      }),
    );
  });
});

/** The first failed check, written as the list of the server. */
function expectedClaim(
  on: boolean,
  known: boolean,
  planet: boolean,
  value: number,
): string | null {
  if (!on) return 'off';
  if (!known) return 'unknown';
  if (!planet) return 'planet';
  return value < item.target ? 'open' : null;
}

describe('claimError', () => {
  const at = { 'buildings:metal': 5 };
  const below = { 'buildings:metal': 4 };

  it('answers each code in the order of the server', () => {
    expect(claimError(false, undefined, false, {})).toBe('off');
    expect(claimError(false, item, true, at)).toBe('off');
    expect(claimError(true, undefined, false, {})).toBe('unknown');
    expect(claimError(true, undefined, true, at)).toBe('unknown');
    expect(claimError(true, item, false, at)).toBe('planet');
    expect(claimError(true, item, true, below)).toBe('open');
    expect(claimError(true, item, true, {})).toBe('open');
    expect(claimError(true, item, true, at)).toBeNull();
  });

  it('names the first failed check of any inputs', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.nat(10),
        (on, known, planet, value) => {
          const progress = { 'buildings:metal': value };
          const expected = expectedClaim(on, known, planet, value);
          expect(
            claimError(on, known ? item : undefined, planet, progress),
          ).toBe(expected);
        },
      ),
    );
  });
});

describe('dailyError', () => {
  it('refuses off first, then without a planet', () => {
    expect(dailyError(false, false)).toBe('off');
    expect(dailyError(false, true)).toBe('off');
    expect(dailyError(true, false)).toBe('planet');
    expect(dailyError(true, true)).toBeNull();
  });
});
