// Builders for the lexicon parts that several entries share (#285): the
// research that strengthens units in battle and the drives. The entry folders
// call them with their own key and words (src/features/<key>/lexicon.de.ts),
// so the core names no key; the formulas are checked against the rules (B8).
import { buildSide, TECH_BONUS, techFactor } from '../battle.ts';
import { FIGHTERS } from '../catalog.ts';
import { DRIVE_BONUS, type DriveKey, speed } from '../components/mobile.ts';
import type { EntryLexicon } from './types.ts';

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/** A share as German percent: 0.1 → „10 %“. */
export const percent = (x: number): string => `${NUMBER.format(x * 100)} %`;

/** A German number: 50000 → „50.000“. */
export const number = (x: number): string => NUMBER.format(x);

const LEVELS = [[0], [1], [2], [5], [10], [21]] as const;

/** The value of a unit in battle that a research raises. */
export type Stat = 'attack' | 'maxShield' | 'maxHull';

/**
 * Weapons, shield or armour research: each level adds the same share to a
 * value of every unit in battle. `label` names the value, as the lists do.
 */
export function techPart(
  research: string,
  stat: Stat,
  label: string,
): EntryLexicon {
  const [unit] = Object.keys(FIGHTERS);
  const at = (level: number): number =>
    buildSide({ units: { [unit!]: 1 }, tech: { [research]: level } })[0]![
      stat
    ] / buildSide({ units: { [unit!]: 1 }, tech: {} })[0]![stat];
  return {
    effect: { label, at: (level) => techFactor(level) - 1, format: 'percent' },
    formulas: [
      {
        text: `${label} = Grundwert · (1 + {bonus} · Stufe)`,
        values: { bonus: percent(TECH_BONUS) },
        fn: (level) => 1 + TECH_BONUS * level,
        rule: at,
        samples: LEVELS,
      },
    ],
  };
}

/**
 * A drive research: each level adds its bonus to the base speed of every
 * ship that flies with this drive.
 */
export function drivePart(drive: DriveKey): EntryLexicon {
  const bonus = DRIVE_BONUS[drive];
  return {
    effect: { label: 'Tempo', at: (level) => bonus * level, format: 'percent' },
    formulas: [
      {
        text: 'Tempo = Grundtempo · (1 + {bonus} · Stufe)',
        values: { bonus: percent(bonus) },
        fn: (base, level) => base! * (1 + bonus * level!),
        rule: (base, level) =>
          speed(
            { cargo: 0, speed: base!, fuel: 1, drive },
            { [drive]: level! },
          ),
        samples: [
          [1000, 0],
          [5000, 1],
          [12500, 6],
          [10000, 15],
        ],
      },
    ],
  };
}
