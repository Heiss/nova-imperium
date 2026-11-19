// The table of the level overview of #187 for a building or research in a
// list: the next levels and the big steps with cost, time and what each
// level brings, with the difference to today. It loads when a table is
// shown (views/LevelOverview.svelte), because the effect of some entries
// is stated in their lexicon file, which is not part of the start bundle.
import { BUILD } from '../../core/catalog.ts';
import { opened } from '../../core/level-overview.ts';
import { text } from '../../core/text.ts';
import type { V } from '../views/common.ts';
import {
  ENERGY_NEED,
  fieldsEffect,
  timeEffects,
  useEffects,
} from './level-effects.ts';
import {
  type LevelEffect,
  levelOf,
  type LevelTable,
  levelTable,
} from './level-table.ts';
import { entryEffect } from './lexicanum.ts';

const name = (key: string): string => text(key)?.n ?? key;

/**
 * What the numbers of the table assume, in the lines below it ([V], the
 * wording of the mockup of #187): whose levels the times count, the energy
 * a producer needs, and what a factor means.
 */
function notes(key: string, effects: readonly LevelEffect[]): string[] {
  const list = Object.hasOwn(BUILD, key)
    ? [`Bauzeiten mit deiner heutigen ${name('robot')} und ${name('nanite')}.`]
    : [
        `Forschungszeiten mit deinem heutigen ${name('lab')} und dem ${name('ifn')}.`,
      ];
  if (effects.some((e) => e.label === ENERGY_NEED))
    list.push(
      'Die Förderung setzt genug Energie voraus; fehlt sie, sinkt sie mit dem Faktor der Energie.',
    );
  if (effects.some((e) => e.format === 'factor'))
    list.push('×1 ist die Zeit ohne diese Gebäudestufe.');
  return list;
}

/**
 * For an entry without a number: what each row opens beyond the one before
 * it, as names; the rows stay without when nothing is opened at all.
 */
function addOpened(v: V, key: string, table: LevelTable): void {
  let from = levelOf(v, key);
  const found = table.rows.map((row) => {
    const names = opened(key, from, row.level).map(name);
    from = row.level;
    return names;
  });
  if (found.every((names) => !names.length)) return;
  table.rows.forEach((row, i) => (row.unlocks = found[i]!));
}

/**
 * The level overview of an entry on the shown planet: cost and time of the
 * next levels, what each brings (the effect of its rule, the store, the
 * producer, what it uses, the time factors) and, for an entry without any,
 * what it opens; null for an entry without levels.
 */
export function overview(v: V, key: string): LevelTable | null {
  const first = entryEffect(v, key) ?? fieldsEffect(key);
  const effects = [
    ...(first ? [first] : []),
    ...useEffects(v, key),
    ...timeEffects(v, key),
  ];
  const table = levelTable(v, key, effects, { own: false });
  if (!table) return null;
  if (!effects.length) addOpened(v, key, table);
  table.notes = notes(key, effects);
  return table;
}
