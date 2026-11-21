import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import { lvlCost } from './economy.ts';
import { text } from './text.ts';
import type { RoundGroup, RoundSetting } from './round.ts';
import type { Cost } from './types.ts';

export const CATEGORIES = {
  buildings: 'Gebäude',
  research: 'Forschung',
  ships: 'Schiffe',
  defense: 'Verteidigung',
  fleet: 'Flotten',
  yard: 'Schiffsschmiede',
} as const;

type AchievementCategory = keyof typeof CATEGORIES;

export interface Achievement {
  id: string;
  metric: string;
  category: AchievementCategory;
  title: string;
  target: number;
  reward: Cost;
}

const LEVELS = [1, 2, 3, 5, 8, 10, 12, 15, 20];
const UNITS = [1, 5, 10, 25, 50, 100, 250, 500];
const ACTIONS = [1, 3, 5, 10, 25, 50, 100, 250];

/** The share of the cost of a level a level achievement pays (#288). */
export const LEVEL_REWARD = 0.05;

/** The share of the cost of a piece, per piece of the target, a unit achievement pays (#288). */
export const UNIT_REWARD = 0.025;

/** No achievement pays more than this of one resource (#288). */
export const REWARD_CAP = 30_000;

function fraction(cost: Cost, rate: number): Cost {
  const scaled = (value: number): number =>
    value ? Math.min(REWARD_CAP, Math.max(1, Math.floor(value * rate))) : 0;
  return [scaled(cost[0]), scaled(cost[1]), scaled(cost[2])];
}

function series(
  category: AchievementCategory,
  key: string,
  title: (target: number) => string,
  targets: number[],
  reward: (target: number) => Cost,
): Achievement[] {
  const metric = `${category}:${key}`;
  return targets.map((target) => ({
    id: `${metric}:${target}`,
    metric,
    category,
    title: title(target),
    target,
    reward: reward(target),
  }));
}

function levels(
  category: 'buildings' | 'research',
  defs: typeof BUILD | typeof RES,
): Achievement[] {
  return Object.entries(defs).flatMap(([key, def]) =>
    series(
      category,
      key,
      (n) => `${text(key)!.n} auf Stufe ${n}`,
      LEVELS,
      (n) => fraction(lvlCost(def, n), LEVEL_REWARD),
    ),
  );
}

function units(
  category: 'ships' | 'defense',
  defs: typeof SHIPS | typeof DEF,
): Achievement[] {
  return Object.entries(defs).flatMap(([key, def]) =>
    series(
      category,
      key,
      (n) => `${n}× ${text(key)!.n} besitzen`,
      UNITS,
      (n) => fraction(def.cost, n * UNIT_REWARD),
    ),
  );
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  ...levels('buildings', BUILD),
  ...levels('research', RES),
  ...units('ships', SHIPS),
  ...units('defense', DEF),
  ...series(
    'fleet',
    'send',
    (n) => `${n} Flotten starten`,
    ACTIONS,
    (n) => [n * 15, n * 8, n * 3],
  ),
  ...series(
    'yard',
    'order',
    (n) => `${n} Aufträge an die Schiffsschmiede erteilen`,
    ACTIONS,
    (n) => [n * 12, n * 6, n * 2],
  ),
];

/**
 * The reward options of a round (#214): two checkboxes in one fieldset of
 * the dialog „Neue Runde“, sent and refused together; existing universes
 * start with both on.
 */
const REWARDS: RoundGroup = {
  name: 'rewards',
  legend: 'Belohnungen für die neue Runde',
};

const REWARDS_REFUSAL =
  'Bitte beide Belohnungseinstellungen für die neue Runde auswählen.';

/**
 * Achievements and daily rewards (#220) in this round, settings of the round
 * (#283). The export under this name registers them (#310, src/core/round.ts).
 */
export const roundSettings = [
  {
    kind: 'switch',
    key: 'roundAchievements',
    name: 'achievements',
    label: 'Achievements aktivieren',
    order: 10,
    group: REWARDS,
    def: true,
    refusal: REWARDS_REFUSAL,
  },
  {
    kind: 'switch',
    key: 'roundDaily',
    name: 'daily',
    label: 'Tagesbelohnungen aktivieren',
    order: 20,
    group: REWARDS,
    def: true,
    refusal: REWARDS_REFUSAL,
  },
] as const satisfies readonly RoundSetting[];

export interface AchievementState {
  progress: Record<string, number>;
  claimed: string[];
  /**
   * The daily reward (#220): the shown streak, whether today's is claimed,
   * the day of the round, today's reward and tomorrow's at today's median
   * production.
   */
  daily: {
    streak: number;
    claimed: boolean;
    day: number;
    reward: Cost;
    next: Cost;
  } | null;
}
