// The achievements folded on a phone (#189): which entries are the next goal
// of their series, what a click unfolds and the words of the buttons.
import { afterEach, describe, expect, it } from 'vitest';
import {
  foldLabel,
  laterGoals,
  toggleFold,
  unfolded,
} from './achievement-fold.ts';

afterEach(() => {
  unfolded.open = false;
  unfolded.claimed = false;
});

interface Goal {
  id: string;
  metric: string;
  done: boolean;
}
const goal = (id: string, metric: string, done = false): Goal => ({
  id,
  metric,
  done,
});
const ids = (set: Set<Goal>): string[] => [...set].map((g) => g.id);

describe('the next goal of a series', () => {
  const later = (goals: Goal[]) =>
    ids(
      laterGoals(
        goals,
        (g) => g.metric,
        (g) => g.done,
      ),
    );

  it('is the first entry that is not done; the following ones are later', () => {
    expect(later([goal('a1', 'a'), goal('a2', 'a'), goal('a3', 'a')])).toEqual([
      'a2',
      'a3',
    ]);
  });

  it('skips what is done, so the next one after it is the goal', () => {
    expect(
      later([goal('a1', 'a', true), goal('a2', 'a'), goal('a3', 'a')]),
    ).toEqual(['a3']);
  });

  it('counts every series for itself', () => {
    expect(
      later([
        goal('a1', 'a'),
        goal('b1', 'b'),
        goal('a2', 'a'),
        goal('b2', 'b', true),
        goal('b3', 'b'),
      ]),
    ).toEqual(['a2', 'b3']);
  });

  it('has nothing later in a series that is done or empty', () => {
    expect(later([])).toEqual([]);
    expect(later([goal('a1', 'a', true), goal('a2', 'a', true)])).toEqual([]);
  });
});

describe('unfolding a group', () => {
  it('starts folded and toggles each group on its own', () => {
    expect(unfolded).toEqual({ open: false, claimed: false });
    toggleFold('open');
    expect(unfolded).toEqual({ open: true, claimed: false });
    toggleFold('claimed');
    toggleFold('open');
    expect(unfolded).toEqual({ open: false, claimed: true });
  });

  it('ignores a group it does not know', () => {
    toggleFold('ready');
    toggleFold('');
    toggleFold('__proto__');
    expect(unfolded).toEqual({ open: false, claimed: false });
  });

  it('names the button by what it does [V]', () => {
    expect(foldLabel('open', 80)).toBe('Alle 80 zeigen');
    expect(foldLabel('claimed', 12)).toBe('12 erledigte zeigen');
    toggleFold('open');
    toggleFold('claimed');
    expect(foldLabel('open', 80)).toBe('Nur die nächsten Ziele zeigen');
    expect(foldLabel('claimed', 12)).toBe('Erledigte ausblenden');
  });
});
