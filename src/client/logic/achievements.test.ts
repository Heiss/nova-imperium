// What the page „Achievements“ shows (#118, bundle 5): the title by the
// round, the daily reward, the filter and the groups with their folds (#189).
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  type AchievementState,
  CATEGORIES,
} from '../../core/achievements.ts';
import type { V } from '../views/common.ts';
import { unfolded } from './achievement-fold.ts';
import { achievementsPage } from './achievements.ts';
import type { GameState } from './types.ts';

const first = ACHIEVEMENTS[0]!;
const second = ACHIEVEMENTS[1]!;

const DAILY = {
  streak: 1234,
  claimed: false,
  day: 5,
  reward: [12_000, 800, 30],
  next: [13_000, 900, 40],
} as const satisfies NonNullable<AchievementState['daily']>;

function view(
  state: Partial<AchievementState> | undefined,
  achievements = true,
): V {
  return {
    s: {
      round: { achievements, daily: !!state?.daily },
      achievements: state && {
        progress: {},
        claimed: [],
        daily: null,
        ...state,
      },
    } as unknown as GameState,
  } as unknown as V;
}

afterEach(() => {
  unfolded.open = false;
  unfolded.claimed = false;
});

describe('the title and the parts of the page', () => {
  it('is only the title while the state is missing', () => {
    expect(achievementsPage(view(undefined))).toEqual({
      title: 'Achievements',
      daily: null,
      list: null,
    });
  });

  it('is „Belohnungen“ with the daily reward alone in a round without achievements', () => {
    const page = achievementsPage(view({ daily: { ...DAILY } }, false));
    expect(page.title).toBe('Belohnungen');
    expect(page.daily).not.toBeNull();
    expect(page.list).toBeNull();
  });

  it('has no box of the daily reward without one, but the list', () => {
    const page = achievementsPage(view({}));
    expect(page.title).toBe('Achievements');
    expect(page.daily).toBeNull();
    expect(page.list?.groups.map((g) => g.title)).toEqual([
      'Einlösbar',
      'Offen',
      'Erledigt',
    ]);
  });
});

describe('the daily reward', () => {
  it('names the streak, today and tomorrow with the minutes of the day', () => {
    const { daily } = achievementsPage(view({ daily: { ...DAILY } }));
    expect(daily).toEqual({
      streak: 'Anmeldeserie: 1.234 Tage (Tageswechsel um 00:00 UTC)',
      day: expect.stringMatching(
        /^Tag 5 der Runde: [\d.]+ Minuten der mittleren Stundenproduktion aller Spieler$/,
      ),
      today: 'Heute: Adamant 12.000 · Psikristall 800 · Promethium 30',
      claimed: false,
      tomorrow: expect.stringMatching(
        /^Morgen \([\d.]+ Minuten, bei gleicher Produktion\): Adamant 13\.000 · Psikristall 900 · Promethium 40$/,
      ),
    });
  });

  it('knows a claimed reward', () => {
    expect(
      achievementsPage(view({ daily: { ...DAILY, claimed: true } })).daily
        ?.claimed,
    ).toBe(true);
  });
});

describe('the filter and the groups', () => {
  it('offers every category and the three states', () => {
    const { filter } = achievementsPage(view({})).list!;
    expect(filter.categories).toEqual(
      Object.entries(CATEGORIES).map(([key, label]) => ({ key, label })),
    );
    expect(filter.statuses.map((c) => c.key)).toEqual([
      'ready',
      'open',
      'claimed',
    ]);
  });

  const groupsOf = (state: Partial<AchievementState>) =>
    Object.fromEntries(
      achievementsPage(view(state)).list!.groups.map((g) => [g.status, g]),
    );

  it('sorts an entry by its progress and by whether it was claimed', () => {
    const groups = groupsOf({
      progress: { [first.metric]: second.target },
      claimed: [first.id],
    });
    expect(groups.claimed!.rows.map((r) => r.id)).toEqual([first.id]);
    expect(groups.ready!.rows.map((r) => r.id)).toEqual([second.id]);
    expect(groups.open!.rows).toHaveLength(ACHIEVEMENTS.length - 2);
  });

  it('shows the progress up to the target and the reward of an entry', () => {
    const row = groupsOf({ progress: { [first.metric]: first.target * 5 } })
      .ready!.rows[0]!;
    expect(row).toMatchObject({
      id: first.id,
      title: first.title,
      category: first.category,
      label: CATEGORIES[first.category],
      progress: String(first.target),
      target: String(first.target),
      status: 'ready',
      later: false,
    });
    expect(row.search).toBe(
      `${first.title} ${CATEGORIES[first.category]}`.toLocaleLowerCase('de'),
    );
    expect(row.reward).toMatch(
      /^Adamant [\d.]+ · Psikristall [\d.]+ · Promethium [\d.]+$/,
    );
  });

  it('marks the entries after the next goal of a series as later', () => {
    const rows = groupsOf({}).open!.rows;
    expect(rows.find((r) => r.id === first.id)!.later).toBe(false);
    expect(rows.find((r) => r.id === second.id)!.later).toBe(true);
    expect(rows.filter((r) => !r.later)).toHaveLength(
      new Set(ACHIEVEMENTS.map((a) => a.metric)).size,
    );
  });

  it('folds „Offen“ and „Erledigt“ with a button, never „Einlösbar“ or an empty group', () => {
    const groups = groupsOf({ claimed: [first.id] });
    expect(groups.ready!.fold).toBeNull();
    expect(groups.open!.fold).toEqual({
      group: 'open',
      all: false,
      label: `Alle ${groups.open!.rows.length} zeigen`,
    });
    expect(groups.claimed!.fold).toEqual({
      group: 'claimed',
      all: false,
      label: '1 erledigte zeigen',
    });
    expect(groupsOf({}).claimed!.fold).toBeNull();
  });

  it('follows what the player unfolded', () => {
    unfolded.open = true;
    unfolded.claimed = true;
    const groups = groupsOf({ claimed: [first.id] });
    expect(groups.open!.fold).toMatchObject({
      all: true,
      label: 'Nur die nächsten Ziele zeigen',
    });
    expect(groups.claimed!.fold).toMatchObject({
      all: true,
      label: 'Erledigte ausblenden',
    });
  });
});
