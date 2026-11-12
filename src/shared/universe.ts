// The settings of a universe: defaults, ranges and the rule that the size of
// the universe never shrinks below a planet that exists. The admin panel, the
// server check and the documentation table read this list.
import type { Universe } from './types.ts';

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
];

export const DEFAULT_UNIVERSE: Universe = Object.fromEntries(
  UNIVERSE_SPECS.map((s) => [s.key, s.def]),
) as unknown as Universe;

/** The largest coordinates that planets use today. */
export interface UsedSize {
  g: number;
  s: number;
  p: number;
}

const checkOne = (
  spec: UniverseSpec,
  raw: unknown,
  used: UsedSize,
): string | null => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < spec.min || value > spec.max)
    return `${spec.label}: ganze Zahl von ${spec.min} bis ${spec.max}.`;
  if (spec.size && value < used[spec.size])
    return `${spec.label}: mindestens ${used[spec.size]}, dort liegen schon Planeten.`;
  return null;
};

/**
 * Checks a complete set of settings. Returns the universe or all errors at
 * once (fail closed: nothing is saved if one value is wrong).
 */
export function validateUniverse(
  input: Record<string, unknown>,
  used: UsedSize,
): { ok: true; value: Universe } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const value: Record<string, number> = {};
  for (const spec of UNIVERSE_SPECS) {
    const error = checkOne(spec, input[spec.key], used);
    if (error) errors.push(error);
    else value[spec.key] = Number(input[spec.key]);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: value as unknown as Universe };
}
