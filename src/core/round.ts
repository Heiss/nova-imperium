// The settings of a round (#283, patterns, section 7): one registry that the
// dialog „Neue Runde“, the universe settings, the reset action and
// `roundRules()` all read. A feature with a value per round defines its
// entries in its own file and exports them as `roundSettings`; the list of
// all of them is generated (`scripts/gen-features.ts`, #310), so this file
// names no feature and a new feature edits none of the shared places. The
// order is fixed (owner, 2026-11-17): the dialog and the refusals follow the
// `order` numbers. An entry is a switch (yes or no) or a whole number in a
// range, shown as a number field or, with `choices`, as a selection. Every
// value is stored under its `key` in the settings; a value the admin does
// not send keeps the one of the current round. The server words a refusal
// with the entry's `refusal`, else with the shared range wording of the
// universe settings (`rangeError`).
import {
  ROUND_ENTRIES,
  ROUND_SECTIONS as SECTIONS,
} from './round-settings.gen.ts';

/**
 * Entries sent as one object and refused together (#214): the reward
 * options are `rewards: { achievements, daily }`. With a `legend` the dialog
 * shows them in one fieldset.
 */
export interface RoundGroup {
  name: string;
  legend?: string;
  /**
   * A line under the members in the dialog „Neue Runde“ that the browser
   * writes again whenever a field changes (#237, the preview of the planet
   * limit). It gets the number of every member of the group by its `name`.
   */
  preview?: (values: Readonly<Record<string, number>>) => string;
  /**
   * The settings of the group chosen, repeated word for word above the
   * button of the dialog „Neue Runde“, so the admin confirms what they chose
   * (#237). Written again whenever a field changes; gets the numbers like
   * `preview`.
   */
  confirm?: (values: Readonly<Record<string, number>>) => string;
}

interface Common<N extends string> {
  /** The stored setting; a `live` entry is a row of the universe settings under it too. */
  key: `round${string}`;
  /** The value in `RoundRules` and in the request „reset“. */
  name: N;
  /** The German label in the dialog „Neue Runde“ (and the universe settings). */
  label: string;
  /**
   * The place in the dialog „Neue Runde“ and among the refusals, ascending
   * and unique (a test checks it), like the catalog entries. A new feature
   * takes the next free ten above the highest number, so it stands last.
   */
  order: number;
  group?: RoundGroup;
  /**
   * The entry is shown in the dialog „Neue Runde“ only while the entry
   * called `name` has `value` (#237: the fields of the colony research only
   * with the research switched on). Hidden, it keeps its value and is sent
   * with the others, and it has no effect while the other one disagrees.
   */
  shownWhen?: { name: string; value: number };
}

/** A value of yes or no, a checkbox in the dialog. */
interface RoundSwitch<N extends string = string> extends Common<N> {
  kind: 'switch';
  def: boolean;
  /** The refusal of a value that is not yes or no. */
  refusal: string;
  /** A sentence below the checkbox, which the checkbox names as its description. */
  note?: string;
  /** Only a number has a rule between settings or an `unstored` value; the code reads both on any entry. */
  agrees?: never;
  unstored?: never;
}

/** A whole number from `min` to `max`, a number field or a selection. */
export interface RoundNumber<N extends string = string> extends Common<N> {
  kind: 'number';
  min: number;
  max: number;
  def: number;
  /**
   * The value of a running round that has none stored: a database from before
   * the setting existed keeps today's game (#237: the planet limit stays
   * unlimited in the round that runs). `def` is then what a new round takes
   * when nothing is sent and what the dialog offers; without `unstored` a
   * missing value is `def` everywhere.
   */
  unstored?: number;
  /** The refusal; without it the range wording of the universe settings. */
  refusal?: string;
  /** Named values instead of a number field (each lies in the range). */
  choices?: readonly { value: number; label: string }[];
  /** Also a row of the universe settings, changed during the round (X1). */
  live?: true;
  /**
   * Whether the value agrees with the other values of the round, a rule
   * between settings (#237); asked only once every value is in its range.
   * `round` holds every value by its stored key. The entry's `refusal` words
   * a disagreement, in the dialog and in the universe settings alike.
   */
  agrees?: (value: number, round: Readonly<Record<string, number>>) => boolean;
}

export type RoundSetting = RoundSwitch | RoundNumber;

/** The settings by their `order` number, the fixed order (owner, 2026-11-17). */
const byOrder = <S extends RoundSetting>(settings: readonly S[]): S[] =>
  [...settings].sort((a, b) => a.order - b.order);

/**
 * The registry in the order of the `order` numbers: the dialog shows the
 * entries in this order and the server checks them in it. The members of a
 * group stand together.
 */
export const ROUND_SETTINGS: readonly RoundSetting[] = byOrder(ROUND_ENTRIES);

/**
 * The settings of one feature under its heading in the admin panel (#357):
 * the heading comes from the feature's file (`roundHeading`), so a new
 * feature gets its section without a change of the views.
 */
export interface RoundSection {
  heading: string;
  /** Its settings in the order of their numbers. */
  settings: readonly RoundSetting[];
}

/**
 * The sections in the fixed order: by the first order number of each. Every
 * file that exports `roundSettings` has at least one (a test checks it).
 */
export const ROUND_SECTIONS: readonly RoundSection[] = SECTIONS.map(
  (x): RoundSection => ({
    heading: x.heading,
    settings: byOrder<RoundSetting>(x.settings),
  }),
).sort((a, b) => a.settings[0]!.order - b.settings[0]!.order);

type ValueOf<S> = S extends { kind: 'switch' } ? boolean : number;

/** The value of every entry by its `name`. */
type RoundValues = {
  -readonly [S in (typeof ROUND_ENTRIES)[number] as S['name']]: ValueOf<S>;
};

/** The rules of the current round: its number and the value of every entry. */
export type RoundRules = { number: number } & RoundValues;

/** A value of the round by name, for the generic code. */
type Values = Record<string, number | boolean>;

/**
 * The values of the running round: a missing setting is the default (the
 * `unstored` value of an entry that has one), a switch is 0 or 1.
 */
export function storedValues(
  stored: (key: string) => number | undefined,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Values {
  const out: Values = {};
  for (const s of settings) {
    const value = stored(s.key);
    if (value === undefined) out[s.name] = s.unstored ?? s.def;
    else out[s.name] = s.kind === 'switch' ? value !== 0 : value;
  }
  return out;
}

/**
 * What a new round takes instead of the value of the running round, where
 * that round has none stored (`unstored`): the default. Only those entries;
 * the dialog offers them and a request that does not send them gets them
 * (#237). Once a round was started, every value is stored and this is empty.
 */
export function freshValues(
  stored: (key: string) => number | undefined,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Record<string, number> {
  return Object.fromEntries(
    settings.flatMap((s) =>
      s.unstored !== undefined && stored(s.key) === undefined
        ? [[s.name, s.def]]
        : [],
    ),
  );
}

/**
 * What the admin sent for an entry, or undefined when it keeps the current
 * value: a member of a group only when the group is not sent.
 */
function sent(s: RoundSetting, data: Record<string, unknown>): unknown {
  if (!s.group) return data[s.name];
  const group = data[s.group.name];
  if (group === undefined) return undefined;
  return (group as Record<string, unknown> | null)?.[s.name] ?? null;
}

const valid = (s: RoundSetting, value: unknown): boolean =>
  s.kind === 'switch'
    ? typeof value === 'boolean'
    : Number.isInteger(value) &&
      (value as number) >= s.min &&
      (value as number) <= s.max;

/** The value of an entry in the new round: as sent, else the current one. */
function chosen(
  s: RoundSetting,
  current: Readonly<Values>,
  data: Record<string, unknown>,
): unknown {
  const value = sent(s, data);
  return value === undefined ? current[s.name] : value;
}

/** The entries whose value disagrees with the other values of the round (#237). */
function disagreeing(
  current: Readonly<Values>,
  data: Record<string, unknown>,
  settings: readonly RoundSetting[],
): RoundSetting[] {
  const round = Object.fromEntries(
    settings.map((s) => [s.key, Number(chosen(s, current, data))]),
  );
  return settings.filter((s) => s.agrees && !s.agrees(round[s.key]!, round));
}

/**
 * The entries refused in a new round, or none: the first refused entry in
 * the order of the registry, with the other refused members of its group. A
 * value out of its range comes first; a rule between settings (`agrees`) is
 * asked only when every value is in its range.
 */
export function roundRefused(
  current: Readonly<Values>,
  data: Record<string, unknown>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): RoundSetting[] {
  const outside = settings.filter((s) => !valid(s, chosen(s, current, data)));
  const wrong = outside.length ? outside : disagreeing(current, data, settings);
  const first = wrong[0];
  if (!first?.group) return wrong.slice(0, 1);
  return wrong.filter((s) => s.group === first.group);
}

/** The values of the new round, once `roundRefused` refused none. */
export function roundValues(
  current: Readonly<Values>,
  data: Record<string, unknown>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Values {
  const out: Values = {};
  for (const s of settings)
    out[s.name] = chosen(s, current, data) as number | boolean;
  return out;
}

/** The request „reset“ for the values of a dialog: a group as one object. */
export function roundRequest(
  values: Readonly<Values>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of settings) {
    const value = values[s.name];
    if (!s.group) out[s.name] = value;
    else
      out[s.group.name] = {
        ...(out[s.group.name] as Values | undefined),
        [s.name]: value,
      };
  }
  return out;
}

/** Whether the dialog shows an entry for the values in its fields (`shownWhen`). */
export const roundShown = (
  s: RoundSetting,
  values: Readonly<Record<string, number | boolean>>,
): boolean =>
  !s.shownWhen || Number(values[s.shownWhen.name]) === s.shownWhen.value;

/** The numbers of the members of `group` by their `name`, as its lines are written from them. */
const membersOf = (
  group: RoundGroup,
  values: Readonly<Record<string, number | boolean>>,
  settings: readonly RoundSetting[],
): Record<string, number> =>
  Object.fromEntries(
    settings
      .filter((s) => s.group === group)
      .map((s) => [s.name, Number(values[s.name])]),
  );

/** The confirmation line of a group for the values in its fields; empty for a group without one (#237). */
export const roundConfirm = (
  group: RoundGroup,
  values: Readonly<Record<string, number | boolean>>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): string => group.confirm?.(membersOf(group, values, settings)) ?? '';

/** The preview line of a group for the values in its fields; empty for a group without one. */
export const roundPreview = (
  group: RoundGroup,
  values: Readonly<Record<string, number | boolean>>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): string => group.preview?.(membersOf(group, values, settings)) ?? '';

/** The id of an entry's field in the dialog: `mainLock` is `round-main-lock`. */
export const roundFieldId = (s: RoundSetting): string =>
  `round-${s.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
