// The settings of a universe: defaults, ranges and the rule that the size of
// the universe never shrinks below a planet that exists. The admin panel, the
// server check and the documentation table read this list.
import {
  DEMOLITION_KEYS,
  DEMOLITION_REFUND,
  DEMOLITION_TIME,
} from './demolition.ts';
import { GIFT_DEFAULT_MINUTES, GIFT_MINUTES } from './endzeit.ts';
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
}

export const UNIVERSE_SPECS: readonly UniverseSpec[] = [
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
  // Issue #202 (owner, 2026-11-16, D3, D4, D7; 2026-11-17, X1): the refund
  // factor and the duration of a demolition, set in „Neue Runde“ and
  // changed here during the round; the same stored settings the round reads.
  {
    key: DEMOLITION_KEYS.refund,
    label: 'Rückbau-Erstattung (%)',
    min: DEMOLITION_REFUND.min,
    max: DEMOLITION_REFUND.max,
    def: DEMOLITION_REFUND.default,
  },
  {
    key: DEMOLITION_KEYS.time,
    label: 'Rückbau-Dauer (% der Bauzeit)',
    min: DEMOLITION_TIME.min,
    max: DEMOLITION_TIME.max,
    def: DEMOLITION_TIME.default,
  },
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
 * within its range, or a size below a coordinate planets use.
 */
export type UniverseCode = 'range' | 'used';

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
): UniverseError[] =>
  UNIVERSE_SPECS.flatMap((spec) => {
    const code = checkOne(spec, input[spec.key], used);
    return code ? [{ spec, code }] : [];
  });

/** The settings as numbers, once `universeErrors` refused none. */
export const universeOf = (input: Record<string, unknown>): Universe =>
  Object.fromEntries(
    UNIVERSE_SPECS.map((spec) => [spec.key, Number(input[spec.key])]),
  ) as unknown as Universe;
