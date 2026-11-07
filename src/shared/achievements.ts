import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import { lvlCost } from './economy.ts';
import type { Cost } from './types.ts';

export const CATEGORIES = {
  buildings: 'Gebäude',
  research: 'Forschung',
  ships: 'Schiffe',
  defense: 'Verteidigung',
  fleet: 'Flotten',
  yard: 'Werft',
} as const;

export type AchievementCategory = keyof typeof CATEGORIES;

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

function fraction(cost: Cost, rate: number): Cost {
  const scaled = (value: number): number =>
    value ? Math.min(30_000, Math.max(1, Math.floor(value * rate))) : 0;
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
      (n) => `${def.n} auf Stufe ${n}`,
      LEVELS,
      (n) => fraction(lvlCost(def, n), 0.05),
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
      (n) => `${n}× ${def.n} besitzen`,
      UNITS,
      (n) => fraction(def.cost, n * 0.025),
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
    (n) => `${n} Werftaufträge erteilen`,
    ACTIONS,
    (n) => [n * 12, n * 6, n * 2],
  ),
];

export function dailyReward(streak: number): Cost {
  const day = Math.min(7, Math.max(1, streak));
  return [20 + 10 * day, 10 + 5 * day, 2 * day];
}

export interface RoundRules {
  number: number;
  achievements: boolean;
  daily: boolean;
}

export interface AchievementState {
  progress: Record<string, number>;
  claimed: string[];
  daily: { streak: number; claimed: boolean; reward: Cost; next: Cost } | null;
}
