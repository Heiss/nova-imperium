// Builders for the lexicon parts that several entries share (#285): the
// research that strengthens units in battle and the drives. The entry folders
// call them with their own key and words (src/features/<key>/lexicon.de.ts),
// so the core names no key; the formulas are checked against the rules (B8).
// The texts before the formulas are drafts of Claude for the owner to confirm
// ([V], owner, 2026-11-17; okf/features/lexicanum-texts.md); every number in
// them is a value from the rules.
import { buildSide, TECH_BONUS, techFactor } from '../battle.ts';
import { FIGHTERS } from '../catalog.ts';
import { lvlCost } from '../components/leveled.ts';
import { DRIVE_BONUS, type DriveKey, speed } from '../components/mobile.ts';
import { capOf } from '../components/storage.ts';
import { growth } from '../rates.ts';
import type { Universe } from '../types.ts';
import type { EntryLexicon, Formula } from './types.ts';

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/** A share as German percent: 0.1 → „10 %“. */
export const percent = (x: number): string => `${NUMBER.format(x * 100)} %`;

/** A German number: 50000 → „50.000“. */
export const number = (x: number): string => NUMBER.format(x);

const LEVELS = [[0], [1], [2], [5], [10], [21]] as const;

/** The levels the texts of the producers and drives compare. */
const LOW = 5;
const HIGH = 10;

/**
 * The values of a text about a producer that grows like a mine (`growth`):
 * what each level adds on top, and how much more the level `high` makes
 * than the level `low`.
 */
export const growthValues: Readonly<Record<string, string>> = {
  step: percent(growth(1) - 1),
  low: number(LOW),
  high: number(HIGH),
  times: number(Math.round((growth(HIGH) / growth(LOW)) * 10) / 10),
};

/** The value of a unit in battle that a research raises. */
export type Stat = 'attack' | 'maxShield' | 'maxHull';

/**
 * Weapons, shield or armour research: each level adds the same share to a
 * value of every unit in battle. `label` names the value, as the lists do,
 * `object` in the text („den Angriff“).
 */
export function techPart(
  research: string,
  stat: Stat,
  label: string,
  object: string,
): EntryLexicon {
  const [unit] = Object.keys(FIGHTERS);
  const at = (level: number): number =>
    buildSide({ units: { [unit!]: 1 }, tech: { [research]: level } })[0]![
      stat
    ] / buildSide({ units: { [unit!]: 1 }, tech: {} })[0]![stat];
  return {
    effect: { label, at: (level) => techFactor(level) - 1, format: 'percent' },
    texts: [
      {
        text: `Jede Stufe hebt ${object} aller deiner Schiffe und Verteidigungsanlagen um {bonus} des Grundwerts. Der Zuwachs zählt immer vom Grundwert, nicht vom schon erreichten Wert: Mit Stufe {double} ist der Wert doppelt so hoch wie ohne die Forschung. Weil der Zuwachs gleich bleibt, der Wert aber wächst, bringt jede weitere Stufe im Verhältnis etwas weniger.`,
        values: {
          bonus: percent(TECH_BONUS),
          double: number(Math.round(1 / TECH_BONUS)),
        },
      },
    ],
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
    texts: [
      {
        text: 'Jede Stufe legt {bonus} des Grundtempos obendrauf – bei jedem Schiff, das mit diesem Antrieb fliegt. Der Zuwachs zählt immer vom Grundtempo, nicht vom schon erreichten Tempo: Stufe {level} bringt {atLevel}. Die Flugzeit sinkt langsamer, als das Tempo steigt: Für die halbe Flugzeit braucht ein Schiff etwa das vierfache Tempo.',
        values: {
          bonus: percent(bonus),
          level: number(LOW),
          atLevel: percent(bonus * LOW),
        },
      },
    ],
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

/** How much a store of a level holds above the base store of the universe. */
const added = (level: number): string => number(capOf(level, { baseStore: 0 }));

/**
 * A store: what its first levels add to the base store, and how the
 * capacity grows after that. Its formula is `storageFormula`.
 */
export function storePart(): EntryLexicon {
  return {
    texts: [
      {
        text: 'Ohne Ausbau fasst das Lager den Grundwert des Universums. Die erste Stufe bringt {one} dazu, die zweite insgesamt {two}, die dritte {three}. Auf Dauer wächst der Ausbau mit jeder Stufe um gut die Hälfte: Stufe {high} bringt schon {atHigh}.',
        values: {
          one: added(1),
          two: added(2),
          three: added(3),
          high: number(HIGH),
          atHigh: added(HIGH),
        },
      },
    ],
  };
}

/** The cost of a level, for every entry with levels („Stufen“). */
export function costFormula(f: number): Formula {
  return {
    text: 'Kosten = Kosten der Stufe 1 · {f}^(Stufe − 1)',
    values: { f: number(f) },
    fn: (base, level) => Math.floor(base! * f ** (level! - 1)),
    rule: (base, level) => lvlCost({ cost: [base!, 0, 0], f }, level!)[0],
    samples: [
      [60, 1],
      [48, 7],
      [200, 12],
      [1000000, 3],
    ],
  };
}

/** The capacity of a store at a level, with the base store of the universe. */
export function storageFormula(u: Universe): Formula {
  return {
    text: 'Lagerkapazität = {base} + 50.000 · (⌈1,6^Stufe⌉ − 1)',
    values: { base: number(u.baseStore) },
    fn: (level) => u.baseStore + 50000 * (Math.ceil(1.6 ** level!) - 1),
    rule: (level) => capOf(level!, u),
    samples: [[0], [1], [5], [12]],
  };
}
