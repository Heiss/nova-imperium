// The level overview of buildings and research (#187, owner, 2026-11-14): a
// table of the next levels with their cost, time and effect. Here is what
// the server and the browser share: the choices of the option „Stufenübersicht“
// of a player and the rule which levels the table shows. The numbers come
// from the formulas of the core (`lvlCost`, `buildTime`, `researchTime`,
// `prod`, `capOf`), the table is drawn in the browser.
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import type { Requirements } from './types.ts';

/**
 * The modes of the option „Stufenübersicht“ in „Hilfe & Optionen“ (D4,
 * owner, 2026-11-14): the table always shown, only behind the ▤ icon, or not
 * at all.
 */
export const LEVEL_MODES = ['always', 'icon', 'hidden'] as const;
export type LevelMode = (typeof LEVEL_MODES)[number];

/** The mode of new and existing players: the ▤ icon (D5, owner, 2026-11-14). */
export const DEFAULT_LEVEL_MODE: LevelMode = 'icon';

export const isLevelMode = (x: unknown): x is LevelMode =>
  (LEVEL_MODES as readonly unknown[]).includes(x);

/** The mode of a stored or sent value; the default when it is none. */
export const levelMode = (x: unknown): LevelMode =>
  isLevelMode(x) ? x : DEFAULT_LEVEL_MODE;

/** The level the multiples of 5 below the next 3 levels are shown up to. */
const BIG_UNTIL = 20;

/**
 * The levels a table shows (#187 D1, owner, 2026-11-14): the next 3, then
 * the multiples of 5 above them up to 20; above that, or when there is
 * none left, the next multiple of 5 after them (level 3 → 4, 5, 6, 10, 15,
 * 20; level 21 → 22, 23, 24, 25; level 22 → 23, 24, 25, 30).
 */
export function levelSteps(level: number): number[] {
  const next = [level + 1, level + 2, level + 3];
  const last = level + 3;
  const big: number[] = [];
  for (let n = (Math.floor(last / 5) + 1) * 5; n <= BIG_UNTIL; n += 5)
    big.push(n);
  if (!big.length) big.push((Math.floor(last / 5) + 1) * 5);
  return [...next, ...big];
}

/** The tables of the catalog whose entries have requirements. */
const NEEDING: readonly Readonly<Record<string, { req?: Requirements }>>[] = [
  BUILD,
  RES,
  SHIPS,
  DEF,
];

/**
 * The entries a building or research opens on the levels above `from` up to
 * `to`: those whose requirement for it lies there, in the order of the
 * catalog (#187, for an entry without a number: „schaltet frei“).
 */
export function opened(key: string, from: number, to: number): string[] {
  const side = Object.hasOwn(BUILD, key) ? 'b' : 'r';
  return NEEDING.flatMap((table) =>
    Object.entries(table).filter(([, def]) => {
      const need = def.req?.[side];
      return (
        need !== undefined &&
        Object.hasOwn(need, key) &&
        need[key]! > from &&
        need[key]! <= to
      );
    }),
  ).map(([k]) => k);
}
