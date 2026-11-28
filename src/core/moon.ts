// Moons (#53, okf/features/moons.md; owner, 2026-11-13 and 2026-11-14): the
// moon chance after a battle at a planet, its roll and the diameter of a new
// moon, and the name a moon shows. This is the moon step of the battle's
// consequences (okf/architecture/patterns.md, section 5), after the debris.
// A moon is a row of the planets with the kind `moon` (#119, O11).
import type { Rng } from './battle.ts';
import type { Debris } from './debris.ts';
import type { RoundSetting, SettingExplain } from './round.ts';
import type { Planet } from './types.ts';

/**
 * The cap of the moon chance in % (#433, owner, 2026-11-27, 207b, 208a):
 * set by the admin per round from 1 to 100, 20 by default as before.
 */
const CAP = { min: 1, max: 100, def: 20 } as const;

/**
 * The Adamant and Psikristall in the Trümmerfeld for 1 % of moon chance
 * (#433, 207b, 212a): 10,000 to 1,000,000 in steps of 10,000, 100,000 by
 * default as before.
 */
export const PER_PERCENT = {
  min: 10_000,
  max: 1_000_000,
  step: 10_000,
  def: 100_000,
} as const;

/** The least chance the admin can give a moon (owner, 2026-11-13; up to the cap since #433, 210a). */
export const MIN_MOON_CHANCE = 1;

/**
 * The chance that counts for the diameter at most (#433, 209a): moons stay
 * as big as before, so the Mondbruch keeps working.
 */
export const DIAMETER_CHANCE = 20;

/** The moon values of a round, by the names of its settings. */
export interface MoonRules {
  moonChanceMax: number;
  moonPerPercent: number;
}

/** The section of the moon settings in „Neue Runde“ [V]: the title of the Lexikon page. */
export const roundHeading = 'Monde';
/** The Trümmerfelder the table of the explanations shows (#358). */
const FIELDS = [100_000, 500_000, 1_000_000, 5_000_000];

/** The moon chance in percent after a battle that leaves such a field (#358). */
const MOON_ROWS: SettingExplain['rows'] = FIELDS.map((m) => ({
  label: () => `Trümmerfeld mit ${m.toLocaleString('de-DE')} Rohstoffen`,
  cell: ({ round }) =>
    `${moonChance({ m, c: 0 }, round as unknown as MoonRules)} %`,
}));

// The cap and the resources per percent, effective at once for the next
// battle [V] (#433, 207b, 211).
export const roundSettings = [
  {
    kind: 'number',
    key: 'roundMoonChanceMax',
    explain: {
      text: 'Die höchste Chance auf einen Mond nach einem Kampf, in Prozent; zugleich die Grenze für „Mond anlegen“ des Admins. Eine Änderung gilt ab dem nächsten Kampf.',
      rows: MOON_ROWS,
      own: true,
    },
    name: 'moonChanceMax',
    label: 'Mondchance höchstens (%)',
    order: 510,
    min: CAP.min,
    max: CAP.max,
    def: CAP.def,
    live: true,
  },
  {
    kind: 'number',
    key: 'roundMoonPerPercent',
    explain: {
      text: 'Wie viel Adamant und Psikristall im Trümmerfeld je Prozent Mondchance nötig ist. Eine Änderung gilt ab dem nächsten Kampf.',
      rows: MOON_ROWS,
      own: true,
    },
    name: 'moonPerPercent',
    label: 'Rohstoffe je 1 % Mondchance',
    order: 520,
    min: PER_PERCENT.min,
    max: PER_PERCENT.max,
    def: PER_PERCENT.def,
    // Steps of 10,000 (212a): the setting's own check and wording (218a).
    step: PER_PERCENT.step,
    agrees: (value) => value % PER_PERCENT.step === 0,
    refusal:
      'Rohstoffe je 1 % Mondchance: ganze Zahl von 10.000 bis 1.000.000 in Schritten von 10.000.',
    live: true,
  },
] as const satisfies readonly RoundSetting[];

/**
 * The moon chance in whole percent: ⌊debris / resources per percent⌋, at
 * most the cap of the round, counted from the whole Trümmerfeld at the
 * position after the battle (#433, 207b).
 */
export const moonChance = (field: Debris, rules: MoonRules): number =>
  Math.min(
    Math.floor((field.m + field.c) / rules.moonPerPercent),
    rules.moonChanceMax,
  );

/** One draw: whether a moon forms at a chance of `chance` %. */
export const formsMoon = (chance: number, rng: Rng): boolean =>
  rng() < chance / 100;

/**
 * The diameter of a new moon in km, by the owiki.de formula
 * ⌊√(x + 3 · chance) · 1000⌋ with x a whole number from 10 to 20, all
 * equally likely, and the chance at most 20 (#433, 209a): 3,605 to 8,944 km.
 */
export function moonDiameter(chance: number, rng: Rng): number {
  const x = 10 + Math.floor(rng() * 11);
  return Math.floor(
    Math.sqrt(x + 3 * Math.min(chance, DIAMETER_CHANCE)) * 1000,
  );
}

/** A moon is always shown as „<Name> (Mond)“ (owner, 2026-11-14). */
export const placeName = (p: Pick<Planet, 'name' | 'kind'>): string =>
  p.kind === 'moon' ? `${p.name} (Mond)` : p.name;
