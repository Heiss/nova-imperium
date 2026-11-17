// The level table of a building or research (#187, built with #285): one
// pure function computes the rows, one component draws them
// (views/LevelTable.svelte). The lists take the cost and time of their next
// level from the same `levelRow()`, so a list and the Lexicanum show the
// same numbers for the same level, planet and universe.
import { BUILD, RES } from '../../core/catalog.ts';
import { buildTime, lvlCost, researchTime } from '../../core/economy.ts';
import { labSite, networkLab } from '../../core/research.ts';
import type { Cost } from '../../core/types.ts';
import type { V } from '../views/common.ts';

/** One level: its cost and its building or research time in ms. */
export interface LevelRow {
  level: number;
  cost: Cost;
  time: number;
}

/**
 * The levels a table shows (#187 D1): the next 3, then the multiples of 5
 * above them up to 20; when there is none, the next multiple of 5 above
 * them (level 3 → 4, 5, 6, 10, 15, 20; level 21 → 22, 23, 24, 25).
 */
export function levelSteps(level: number): number[] {
  const next = [level + 1, level + 2, level + 3];
  const last = level + 3;
  const big: number[] = [];
  for (let n = (Math.floor(last / 5) + 1) * 5; n <= 20; n += 5) big.push(n);
  if (!big.length) big.push((Math.floor(last / 5) + 1) * 5);
  return [...next, ...big];
}

/** The level of a building on the shown planet or of a research. */
export const levelOf = (v: V, key: string): number =>
  (Object.hasOwn(BUILD, key) ? v.P.b[key] : v.R.research[key]) ?? 0;

/**
 * The cost and time of one level of a building or research on the shown
 * planet: the time with its Servitorenschmiede and Machina-Schwarmhalle,
 * or with its Scholarium and the linked ones (#49); undefined for a key
 * without levels.
 */
export function levelRow(
  v: V,
  key: string,
  level: number,
): LevelRow | undefined {
  const { P, s } = v;
  const building = BUILD[key];
  if (building) {
    const cost = lvlCost(building, level);
    return { level, cost, time: buildTime(cost, P, s.cfg) };
  }
  const research = RES[key];
  if (!research) return undefined;
  const cost = lvlCost(research, level);
  const lab = networkLab(key, labSite(P), s.labs, v.R.research.ifn ?? 0);
  return { level, cost, time: researchTime(cost, { b: { lab } }, s.cfg) };
}

/** What a level brings, as a number of the entry's rule. */
export interface LevelEffect {
  label: string;
  at: (level: number) => number;
  format?: 'percent';
  unit?: string;
}

/** A row of the table with its effect, and whether it is the own level. */
export interface LevelTableRow extends LevelRow {
  effect?: number;
  current: boolean;
}

export interface LevelTable {
  /** „Bauzeit“ or „Forschungszeit“, as the lists say. */
  timeLabel: string;
  effect?: Omit<LevelEffect, 'at'>;
  rows: LevelTableRow[];
}

/**
 * The table of an entry with levels: the own level first when there is one
 * (marked, B5 of #285), then the levels of `levelSteps`; null for an entry
 * without levels.
 */
export function levelTable(
  v: V,
  key: string,
  effect?: LevelEffect,
): LevelTable | null {
  if (!levelRow(v, key, 1)) return null;
  const own = levelOf(v, key);
  const levels = own ? [own, ...levelSteps(own)] : levelSteps(own);
  const table: LevelTable = {
    timeLabel: Object.hasOwn(BUILD, key) ? 'Bauzeit' : 'Forschungszeit',
    rows: levels.map((level) => {
      const row: LevelTableRow = {
        ...levelRow(v, key, level)!,
        current: level === own,
      };
      if (effect) row.effect = effect.at(level);
      return row;
    }),
  };
  if (effect) {
    const { at: _, ...shown } = effect;
    table.effect = shown;
  }
  return table;
}
