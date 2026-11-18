// The settings of a round (#283, patterns, section 7): one registry that the
// dialog „Neue Runde“, the universe settings, the reset action and
// `roundRules()` all read. A feature with a value per round adds one entry
// in its own file, with its own `order` number, and one line to the list
// below; it edits none of the shared places. The order is fixed (owner,
// 2026-11-17): the dialog and the refusals follow the `order` numbers. An entry is a switch (yes or no) or a whole number in a
// range, shown as a number field or, with `choices`, as a selection. Every
// value is stored under its `key` in the settings; a value the admin does
// not send keeps the one of the current round. The server words a refusal
// with the entry's `refusal`, else with the shared range wording of the
// universe settings (`rangeError`).
import { ABANDON_LOCK_SETTING } from './abandon.ts';
import { ACHIEVEMENTS_SETTING, DAILY_SETTING } from './achievements.ts';
import {
  RECOGNITION_COUNTS_SETTING,
  RECOGNITION_TOTAL_SETTING,
  RECOGNITION_TYPES_SETTING,
} from './fleet-recognition.ts';
import { GUILDS_SETTING } from './guild-chat.ts';
import { MAIN_LOCK_SETTING } from './main-planet.ts';

/**
 * Entries sent as one object and refused together (#214): the reward
 * options are `rewards: { achievements, daily }`. With a `legend` the dialog
 * shows them in one fieldset.
 */
export interface RoundGroup {
  name: string;
  legend?: string;
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
}

/** A value of yes or no, a checkbox in the dialog. */
interface RoundSwitch<N extends string = string> extends Common<N> {
  kind: 'switch';
  def: boolean;
  /** The refusal of a value that is not yes or no. */
  refusal: string;
  /** A sentence below the checkbox, which the checkbox names as its description. */
  note?: string;
}

/** A whole number from `min` to `max`, a number field or a selection. */
export interface RoundNumber<N extends string = string> extends Common<N> {
  kind: 'number';
  min: number;
  max: number;
  def: number;
  /** The refusal; without it the range wording of the universe settings. */
  refusal?: string;
  /** Named values instead of a number field (each lies in the range). */
  choices?: readonly { value: number; label: string }[];
  /** Also a row of the universe settings, changed during the round (X1). */
  live?: true;
}

export type RoundSetting = RoundSwitch | RoundNumber;

/** The entries as the features add them; their place here means nothing. */
const ENTRIES = [
  ABANDON_LOCK_SETTING,
  ACHIEVEMENTS_SETTING,
  DAILY_SETTING,
  GUILDS_SETTING,
  MAIN_LOCK_SETTING,
  RECOGNITION_COUNTS_SETTING,
  RECOGNITION_TOTAL_SETTING,
  RECOGNITION_TYPES_SETTING,
] as const satisfies readonly RoundSetting[];

/** The settings by their `order` number, the fixed order (owner, 2026-11-17). */
const byOrder = <S extends RoundSetting>(settings: readonly S[]): S[] =>
  [...settings].sort((a, b) => a.order - b.order);

/**
 * The registry in the order of the `order` numbers: the dialog shows the
 * entries in this order and the server checks them in it. The members of a
 * group stand together.
 */
export const ROUND_SETTINGS: readonly (typeof ENTRIES)[number][] =
  byOrder(ENTRIES);

type ValueOf<S> = S extends { kind: 'switch' } ? boolean : number;

/** The value of every entry by its `name`. */
type RoundValues = {
  -readonly [S in (typeof ENTRIES)[number] as S['name']]: ValueOf<S>;
};

/** The rules of the current round: its number and the value of every entry. */
export type RoundRules = { number: number } & RoundValues;

/** A value of the round by name, for the generic code. */
type Values = Record<string, number | boolean>;

/** The values as stored: a missing setting is the default, a switch is 0 or 1. */
export function storedValues(
  stored: (key: string) => number | undefined,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Values {
  const out: Values = {};
  for (const s of settings) {
    const value = stored(s.key);
    out[s.name] =
      value === undefined ? s.def : s.kind === 'switch' ? value !== 0 : value;
  }
  return out;
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

/**
 * The entries refused in a new round, or none: the first refused entry in
 * the order of the registry, with the other refused members of its group.
 */
export function roundRefused(
  current: Readonly<Values>,
  data: Record<string, unknown>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): RoundSetting[] {
  const wrong = settings.filter((s) => !valid(s, chosen(s, current, data)));
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

/** The id of an entry's field in the dialog: `mainLock` is `round-main-lock`. */
export const roundFieldId = (s: RoundSetting): string =>
  `round-${s.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
