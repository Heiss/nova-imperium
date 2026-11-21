// The level table of a building or research (#187, built with #285): one
// pure function computes the rows, one component draws them
// (views/LevelTable.svelte). The lists take the cost and time of their next
// level from the same `levelRow()`, so a list, the level overview and the
// Lexicanum show the same numbers for the same level, planet and universe.
// Which levels a table shows is the rule of the core (`levelSteps`).
import { BUILD, RES } from '../../core/catalog.ts';
import { buildTime, lvlCost, researchTime } from '../../core/economy.ts';
import { levelSteps } from '../../core/level-overview.ts';
import { labSite, networkLab } from '../../core/research.ts';
import type { Cost } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { fmt } from './format.ts';

/** One level: its cost and its building or research time in ms. */
export interface LevelRow {
  level: number;
  cost: Cost;
  time: number;
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

/** How a value is shown: a number, a percentage (0.3 → „+30 %“) or a factor („×0,5“). */
type EffectFormat = 'percent' | 'factor';

/** What a level brings, as a number of the entry's rule. */
export interface LevelEffect {
  label: string;
  at: (level: number) => number;
  format?: EffectFormat;
  unit?: string;
  /** A value that costs (an energy need, a time): its rise is shown as the worse. */
  cost?: true;
}

/** The heading of an effect column, without its values. */
type EffectHead = Omit<LevelEffect, 'at'>;

/** A row of the table with its effects, and whether it is the own level. */
interface LevelTableRow extends LevelRow {
  /** The value of each effect at this level. */
  values: number[];
  /** The value of each effect minus that of the own level (the difference to today). */
  deltas: number[];
  /** The first of the big steps, after the next 3 levels (#187 D1). */
  big: boolean;
  current: boolean;
  /** What this level opens, for an entry without a number: the names (#187). */
  unlocks?: string[];
}

export interface LevelTable {
  /** „Bauzeit“ or „Forschungszeit“, as the lists say. */
  timeLabel: string;
  effects: EffectHead[];
  rows: LevelTableRow[];
  /** Lines below the table: what its numbers assume (#187). */
  notes?: string[];
}

/** The heading of an effect column: its fields without the function. */
const head = ({ label, format, unit, cost }: LevelEffect): EffectHead => ({
  label,
  ...(format ? { format } : {}),
  ...(unit ? { unit } : {}),
  ...(cost ? { cost } : {}),
});

/** How the table is made up: the own level as a row, or only the next ones. */
interface Options {
  /** The own level first, marked (the article, #285 B5); else only the levels to come. */
  own: boolean;
}

/**
 * The table of an entry with levels: the own level first when asked for and
 * there is one (marked, B5 of #285), then the levels of `levelSteps` with
 * each effect and its difference to the own level; null for an entry
 * without levels.
 */
export function levelTable(
  v: V,
  key: string,
  effects: readonly LevelEffect[] = [],
  { own: withOwn }: Options = { own: true },
): LevelTable | null {
  if (!levelRow(v, key, 1)) return null;
  const own = levelOf(v, key);
  const steps = levelSteps(own);
  const levels = own && withOwn ? [own, ...steps] : steps;
  const today = effects.map((e) => e.at(own));
  return {
    timeLabel: Object.hasOwn(BUILD, key) ? 'Bauzeit' : 'Forschungszeit',
    effects: effects.map(head),
    rows: levels.map((level) => {
      const values = effects.map((e) => e.at(level));
      return {
        ...levelRow(v, key, level)!,
        values,
        deltas: values.map((x, i) => x - today[i]!),
        big: level === steps[3],
        current: level === own,
      };
    }),
  };
}

/** The number format of the table, with decimals for a factor. */
const FACTOR = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/** An effect as the table shows it: „+30 %“, „12 Systeme“, „×0,5“ or „5“. */
export function effectText(
  value: number,
  e: Pick<LevelEffect, 'format' | 'unit'>,
): string {
  if (e.format === 'percent') return `+${fmt(Math.round(value * 100))} %`;
  if (e.format === 'factor') return `×${FACTOR.format(value)}`;
  return `${fmt(value)}${e.unit ? ` ${e.unit}` : ''}`;
}

/**
 * The difference to today as the table shows it: „+280“, „−19“ or „+10 %“;
 * a sign for any value, undefined when nothing changes.
 */
export function deltaText(
  delta: number,
  e: Pick<LevelEffect, 'format'>,
): string | undefined {
  const sign = delta < 0 ? '−' : '+';
  const abs = Math.abs(delta);
  if (e.format === 'percent') {
    const n = Math.round(abs * 100);
    return n ? `${sign}${fmt(n)} %` : undefined;
  }
  if (e.format === 'factor') {
    const n = Number(FACTOR.format(abs).replace(',', '.'));
    return n ? `${sign}${FACTOR.format(abs)}` : undefined;
  }
  return Math.floor(abs) ? `${sign}${fmt(abs)}` : undefined;
}
