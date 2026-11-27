// The settings of a universe: defaults, ranges and the rule that the size of
// the universe never shrinks below a planet that exists. The admin panel, the
// server check and the documentation table read this list. A `live` setting
// of the round (#283, X1) is a row here too, read from the registry
// `ROUND_SETTINGS`, under the key the round stores it.
import { GIFT_DEFAULT_MINUTES, GIFT_MINUTES } from './endzeit.ts';
import {
  ROUND_SECTIONS,
  ROUND_SETTINGS,
  type RoundMark,
  type RoundNumber,
  type RoundSection,
  type RoundSetting,
} from './round.ts';
import type { Coords, Universe } from './types.ts';

type UniverseKey = keyof Universe;

export interface UniverseSpec {
  key: UniverseKey;
  label: string;
  min: number;
  max: number;
  def: number;
  /** Size of the universe: it may grow, never shrink below a used coordinate. */
  size?: 'g' | 's' | 'p';
  /** Named values instead of a number field (a setting of the round, #283). */
  choices?: readonly { value: number; label: string }[];
  /** The step of the number field of a setting of the round (#433, 218a). */
  step?: number;
  /** The mark of a setting of the round (#441, 235b). */
  mark?: RoundMark;
  /** A rule between settings of the round (#237), with its wording. */
  agrees?: RoundNumber['agrees'];
  refusal?: string;
}

/** The rows of the `live` settings of the round (#283, X1). */
export const liveSpecs = (
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): UniverseSpec[] =>
  settings.flatMap((s) =>
    s.kind === 'number' && s.live
      ? [
          {
            key: s.key,
            label: s.label,
            min: s.min,
            max: s.max,
            def: s.unstored ?? s.def,
            ...(s.choices ? { choices: s.choices } : {}),
            ...(s.step ? { step: s.step } : {}),
            ...(s.mark ? { mark: s.mark } : {}),
            ...(s.agrees ? { agrees: s.agrees, refusal: s.refusal } : {}),
          },
        ]
      : [],
  );

const SPECS: readonly UniverseSpec[] = [
  { key: 'speed', label: 'Tempo (Faktor)', min: 1, max: 100, def: 5 },
  { key: 'galaxies', label: 'Galaxien', min: 1, max: 9, def: 2, size: 'g' },
  {
    key: 'systems',
    label: 'Systeme je Galaxie',
    min: 1,
    max: 499,
    def: 50,
    size: 's',
  },
  // A new planet is placed on a position from 4 to 12, so 12 is the minimum.
  {
    key: 'positions',
    label: 'Positionen je System',
    min: 12,
    max: 20,
    def: 15,
    size: 'p',
  },
  {
    key: 'baseStore',
    label: 'Grundlager je Rohstoff',
    min: 10000,
    max: 10000000,
    def: 100000,
  },
  {
    key: 'maxReports',
    label: 'Berichte je Spieler',
    min: 10,
    max: 500,
    def: 60,
  },
  {
    key: 'startMetal',
    label: 'Start-Adamant',
    min: 0,
    max: 10000000,
    def: 500,
  },
  {
    key: 'startCrystal',
    label: 'Start-Psikristall',
    min: 0,
    max: 10000000,
    def: 500,
  },
  {
    key: 'startDeuterium',
    label: 'Start-Promethium',
    min: 0,
    max: 10000000,
    def: 0,
  },
  // Issue #51, D4 (owner, 2026-11-13).
  {
    key: 'extraFields',
    label: 'Zusatzfelder pro Planet',
    min: 0,
    max: 100,
    def: 0,
  },
  // Issue #161 (owner, 2026-11-14): the flight time the „Endzeit“ dialog
  // offers first; the dialog may change it for one trigger only.
  {
    key: 'endzeitMinutes',
    label: 'Flugzeit der Endzeit-Gabe (Minuten)',
    min: GIFT_MINUTES.min,
    max: GIFT_MINUTES.max,
    def: GIFT_DEFAULT_MINUTES,
  },
];

/** The heading of the base values of the universe in the admin panel (#357): the tab „Universum“ [V]. */
export const UNIVERSE_HEADING = 'Universum';

/**
 * The settings of the tab „Universum“ under headings (#357): the base values
 * of the universe first, then each live setting of the round under the
 * heading of its feature, in the order of „Neue Runde“. A key the registry
 * of the round does not know is a base value.
 */
export function universeSections(
  keys: readonly string[],
  sections: readonly RoundSection[] = ROUND_SECTIONS,
): { heading: string; keys: string[] }[] {
  const owner = new Map(
    sections.flatMap((x) =>
      x.settings.map((s) => [s.key as string, x.heading]),
    ),
  );
  const base = keys.filter((k) => !owner.has(k));
  return [
    ...(base.length ? [{ heading: UNIVERSE_HEADING, keys: base }] : []),
    ...sections.flatMap((x) => {
      const mine = keys.filter((k) => owner.get(k) === x.heading);
      return mine.length ? [{ heading: x.heading, keys: mine }] : [];
    }),
  ];
}

export const UNIVERSE_SPECS: readonly UniverseSpec[] = [
  ...SPECS,
  ...liveSpecs(),
];

export const DEFAULT_UNIVERSE: Universe = Object.fromEntries(
  UNIVERSE_SPECS.map((s) => [s.key, s.def]),
) as unknown as Universe;

/**
 * Whether a position lies inside the universe: galaxy, system and position
 * at most the configured counts (a free target must still exist on arrival).
 */
export const inUniverse = ({ g, s, p }: Coords, u: Universe): boolean =>
  g <= u.galaxies && s <= u.systems && p <= u.positions;

/** The largest coordinates that planets use today. */
export interface UsedSize {
  g: number;
  s: number;
  p: number;
}

/**
 * Why a setting is refused (#214, patterns, section 7): not a whole number
 * within its range, a size below a coordinate planets use, or a value that
 * disagrees with the other settings of the round (#237).
 */
export type UniverseCode = 'range' | 'used' | 'conflict';

/** A refused setting: its spec and the code; the server words it. */
interface UniverseError {
  spec: UniverseSpec;
  code: UniverseCode;
}

const checkOne = (
  spec: UniverseSpec,
  raw: unknown,
  used: UsedSize,
): UniverseCode | null => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < spec.min || value > spec.max)
    return 'range';
  return spec.size && value < used[spec.size] ? 'used' : null;
};

/**
 * Checks a complete set of settings: every refused setting, in the order of
 * UNIVERSE_SPECS, or none (fail closed: nothing is saved if one value is
 * wrong).
 */
export const universeErrors = (
  input: Record<string, unknown>,
  used: UsedSize,
  specs: readonly UniverseSpec[] = UNIVERSE_SPECS,
): UniverseError[] => {
  const errors = specs.flatMap((spec) => {
    const code = checkOne(spec, input[spec.key], used);
    return code ? [{ spec, code }] : [];
  });
  if (errors.length) return errors;
  // A rule between settings is asked once every value is in its range (#237).
  const round = Object.fromEntries(
    specs.map((spec) => [spec.key, Number(input[spec.key])]),
  );
  return specs.flatMap((spec) =>
    spec.agrees && !spec.agrees(round[spec.key]!, round)
      ? [{ spec, code: 'conflict' as const }]
      : [],
  );
};

/** The settings as numbers, once `universeErrors` refused none. */
export const universeOf = (input: Record<string, unknown>): Universe =>
  Object.fromEntries(
    UNIVERSE_SPECS.map((spec) => [spec.key, Number(input[spec.key])]),
  ) as unknown as Universe;
