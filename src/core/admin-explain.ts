// The explanations of the admin panel (#358; owner, 2026-11-22 and 286c): an
// explanation per setting behind a „?“, for the admin only, never part of the
// players' Lexicanum. Each text lives beside its registry entry (`explain` of
// a universe spec or of a round setting), so a new setting brings its own;
// this module gathers them and builds the tables. A table shows a setting at
// its minimum, two values in between, its maximum and its current value
// (owner E3); every cell is computed with the functions of src/core at render
// time, none is typed.
import { duration, nameOf, number } from './lexicon/say.ts';
import type { Block } from './lexicon/types.ts';
import {
  ROUND_SETTINGS,
  type ExplainCell,
  type RoundRules,
  type RoundSetting,
  type SettingExplain,
} from './round.ts';
import type { Universe } from './types.ts';
import { UNIVERSE_SPECS, type UniverseSpec } from './universe.ts';

/** A setting of the admin panel with what its explanation needs. */
export interface Explained {
  /** The stored key: the id of its row (`set_<key>`) and of its „?“. */
  key: string;
  label: string;
  explain?: SettingExplain;
  /** The name in the rules of the round, for a setting of the round. */
  name?: string;
  min?: number;
  max?: number;
  choices?: readonly { value: number; label: string }[];
}

const fromSpec = (s: UniverseSpec): Explained => ({
  key: s.key,
  label: s.label,
  ...(s.explain ? { explain: s.explain } : {}),
  min: s.min,
  max: s.max,
  ...(s.choices ? { choices: s.choices } : {}),
});

/** The name of a round setting stored under `key`, if it is one. */
const roundName = (
  key: string,
  settings: readonly RoundSetting[],
): string | undefined => settings.find((s) => s.key === key)?.name;

/**
 * Every setting of the admin panel: the rows of the tab „Universum“ (the
 * base values and the live settings of the round) and the switches of the
 * dialog „Neue Runde“, which have no row there.
 */
export function explainedSettings(
  specs: readonly UniverseSpec[] = UNIVERSE_SPECS,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Explained[] {
  const rows = specs.map((s) => {
    const name = roundName(s.key, settings);
    return { ...fromSpec(s), ...(name ? { name } : {}) };
  });
  const known = new Set(rows.map((r) => r.key));
  const switches = settings
    .filter((s) => !known.has(s.key))
    .map((s): Explained => ({
      key: s.key,
      label: s.label,
      name: s.name,
      ...(s.explain ? { explain: s.explain } : {}),
    }));
  return [...rows, ...switches];
}

/**
 * The values of the columns: the minimum, two values in between (a third and
 * two thirds of the range, rounded) and the maximum, each once.
 */
export function columnValues(min: number, max: number): number[] {
  const third = (max - min) / 3;
  return [
    ...new Set([
      min,
      Math.round(min + third),
      Math.round(min + 2 * third),
      max,
    ]),
  ];
}

/** A value as its column names it: the label of its choice, else the number. */
export const valueLabel = (s: Explained, value: number): string =>
  s.choices?.find((c) => c.value === value)?.label ?? number(value);

/** The current value of a setting: from the universe, else from the round. */
const currentOf = (s: Explained, u: Universe, round: RoundRules): number => {
  const stored = (u as unknown as Record<string, unknown>)[s.key];
  if (typeof stored === 'number') return stored;
  const ruled = s.name
    ? (round as unknown as Record<string, unknown>)[s.name]
    : undefined;
  return typeof ruled === 'number' ? ruled : Number(ruled === true);
};

/** The universe and the round with the setting at `value`. */
const withValue = (
  s: Explained,
  u: Universe,
  round: RoundRules,
  value: number,
) => ({
  u: { ...u, [s.key]: value } as Universe,
  round: {
    ...Object.fromEntries(
      Object.entries(round).map(([k, v]) => [k, Number(v)]),
    ),
    ...(s.name ? { [s.name]: value } : {}),
  },
});

type At = ReturnType<typeof withValue>;

/**
 * Whether the values of a column agree with each other by the rules between
 * settings (`agrees`, #237), as the server checks them: a column the server
 * refuses shows no values (PR #471).
 */
function agreed(x: At, settings: readonly RoundSetting[]): boolean {
  const stored = x.u as unknown as Record<string, number | undefined>;
  const byKey = Object.fromEntries(
    settings.map((r) => [r.key, stored[r.key] ?? x.round[r.name]!]),
  );
  return settings.every((r) => !r.agrees || r.agrees(byKey[r.key]!, byKey));
}

/** A cell as the table shows it. */
export function cellText(cell: ExplainCell): string {
  if (cell === null) return NONE;
  if (typeof cell === 'number') return number(cell);
  if (typeof cell === 'object') return duration(cell.ms);
  return cell;
}

/** A cell without a value. */
export const NONE = '–';

/** The word after the current value in the head of a table [V]. */
export const NOW = 'jetzt';

/**
 * The table of an explanation, or null for a setting without one: a column
 * per value of `columnValues` and one for the current value. A column the
 * rules between settings refuse shows `NONE`; a table whose other cells are
 * all the same says nothing and is left out, so the text stands alone (the
 * limit of planets while it is off, PR #471).
 */
export function explainTable(
  s: Explained,
  u: Universe,
  round: RoundRules,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Extract<Block, { t: 'table' }> | null {
  const rows = s.explain?.rows;
  if (!rows?.length || s.min === undefined || s.max === undefined) return null;
  const current = currentOf(s, u, round);
  const values = [...columnValues(s.min, s.max), current];
  const at = values.map((v) => withValue(s, u, round, v));
  const open = at.map((x) => agreed(x, settings));
  const cells = rows.map((row) =>
    at.map((x, i) => (open[i] ? cellText(row.cell(x)) : NONE)),
  );
  const shown = cells.flat().filter((c, i) => open[i % at.length]);
  if (new Set(shown).size < 2) return null;
  return {
    t: 'table',
    head: [
      s.label,
      ...values.map((v, i) =>
        i === values.length - 1
          ? `${valueLabel(s, v)} (${NOW})`
          : valueLabel(s, v),
      ),
    ],
    rows: rows.map((row, r) => ({
      cells: [row.label(nameOf), ...cells[r]!],
    })),
  };
}
