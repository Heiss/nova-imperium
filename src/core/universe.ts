// The settings of a universe: defaults, ranges and the rule that the size of
// the universe never shrinks below a planet that exists. The admin panel, the
// server check and the documentation table read this list. A `live` setting
// of the round (#283, X1) is a row here too, read from the registry
// `ROUND_SETTINGS`, under the key the round stores it.
import { GIFT_DEFAULT_MINUTES, GIFT_MINUTES } from './endzeit.ts';
import {
  type PresetId,
  presetValues,
  ROUND_SECTIONS,
  ROUND_SETTINGS,
  type RoundMark,
  type RoundNumber,
  type RoundSection,
  type RoundSetting,
  type SettingExplain,
} from './round.ts';
import { BUILD, RES, SHIPS } from './catalog.ts';
import {
  buildTime,
  capOf,
  lvlCost,
  prod,
  researchTime,
  unitTime,
} from './economy.ts';
import { expeditionPosition } from './expedition.ts';
import { maxFields, minDiameter } from './fields.ts';
import { distance, fleetSpeed, flightMs } from './flight.ts';
import { duration, number } from './lexicon/say.ts';
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
  /** The explanation behind its „?“ in the admin panel (#358); a test asks for one. */
  explain?: SettingExplain;
}

type NumberSetting = Extract<RoundSetting, { kind: 'number' }>;

/** The optional parts of a row of a `live` setting, only where it has them. */
const liveExtras = (s: NumberSetting): Partial<UniverseSpec> => ({
  ...(s.choices ? { choices: s.choices } : {}),
  ...(s.step ? { step: s.step } : {}),
  ...(s.mark ? { mark: s.mark } : {}),
  ...(s.agrees ? { agrees: s.agrees, refusal: s.refusal } : {}),
  ...(s.explain ? { explain: s.explain } : {}),
});

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
            ...liveExtras(s),
          },
        ]
      : [],
  );

// The examples of the tables of the explanations (#358), by id: the names
// come from the catalog when the table is drawn.
const MINE = 'metal';
const POWER = 'solar';
const STUDY = 'energy';
const FIGHTER = 'lf';
const CARGO = 'sc';
const STORE = 'smetal';
const HOME = { g: 1, s: 1, p: 1 };
/** One system and one galaxy away from `HOME`. */
const NEXT_SYSTEM = { g: 1, s: 2, p: 1 };
const NEXT_GALAXY = { g: 2, s: 1, p: 1 };

/** The flight of one ship of `CARGO` at full speed from `HOME` to `to`. */
const flight = (to: Coords, u: Universe): string =>
  duration(
    flightMs(
      distance(HOME, to),
      fleetSpeed({ [CARGO]: 1 }, { research: {} }),
      10,
      u,
    ),
  );

const SPEED_ROWS: SettingExplain['rows'] = [
  {
    label: (name) => `${name(MINE)} Stufe 10: Bauzeit`,
    cell: ({ u }) =>
      duration(buildTime(lvlCost(BUILD[MINE]!, 10), { b: {} }, u)),
  },
  {
    label: (name) => `${name(STUDY)} Stufe 5: Forschungszeit`,
    cell: ({ u }) =>
      duration(researchTime(lvlCost(RES[STUDY]!, 5), { b: {} }, u)),
  },
  {
    label: (name) => `${name(FIGHTER)}: Bauzeit je Schiff`,
    cell: ({ u }) => duration(unitTime(SHIPS[FIGHTER]!, { b: {} }, u)),
  },
  {
    label: (name) =>
      `${name(MINE)} Stufe 10 mit ${name(POWER)} Stufe 10: Förderung je Stunde`,
    cell: ({ u }) =>
      number(
        Math.floor(
          prod({ b: { [MINE]: 10, [POWER]: 10 }, pct: {}, temp: 50 }, u).m,
        ),
      ),
  },
  {
    label: (name) => `Flug ${name(CARGO)}, ein System weiter`,
    cell: ({ u }) => flight(NEXT_SYSTEM, u),
  },
  {
    label: (name) => `Flug ${name(CARGO)}, eine Galaxie weiter`,
    cell: ({ u }) => flight(NEXT_GALAXY, u),
  },
];

/** The store levels of the table of the base storage. */
const STORE_LEVELS = [0, 1, 5, 10];

/** The planets of the table of the extra fields: one of each size by its fields. */
const FIELD_SIZES = [100, 163, 225];

const SPECS: readonly UniverseSpec[] = [
  {
    key: 'speed',
    label: 'Tempo (Faktor)',
    min: 1,
    max: 100,
    def: 5,
    explain: {
      text: 'Das Tempo teilt alle Bau-, Forschungs- und Schiffsbauzeiten, die Flugzeiten von Flotten und Raketen und die Wartezeit der Warp-Tore. Es vervielfacht die Förderung der Minen und den Promethium-Verbrauch der Kraftwerke, die Promethium verbrennen. Der Treibstoff einer Flotte bleibt gleich. Die Haltezeit einer Expedition teilt es nur, wenn „Haltezeit durch das Universums-Tempo teilen“ an ist. Bei einer Änderung zählt die Zeit bis jetzt mit dem alten Tempo; laufende Aufträge und Flüge behalten ihr Ende.',
      rows: SPEED_ROWS,
      own: true,
    },
  },
  {
    key: 'galaxies',
    label: 'Galaxien',
    min: 1,
    max: 9,
    def: 2,
    size: 'g',
    explain: {
      text: 'Wie viele Galaxien das Universum hat: wo neue Heimatplaneten liegen, wohin Flotten fliegen können und wie weit die Sternenkarte reicht. Senken lässt sich der Wert nur bis zur höchsten Galaxie, in der ein Planet liegt.',
    },
  },
  {
    key: 'systems',
    label: 'Systeme je Galaxie',
    explain: {
      text: 'Wie viele Systeme jede Galaxie hat: wo neue Heimatplaneten liegen, wohin Flotten fliegen können und wie weit die Sternenkarte reicht. Senken lässt sich der Wert nur bis zum höchsten System, in dem ein Planet liegt.',
    },
    min: 1,
    max: 499,
    def: 50,
    size: 's',
  },
  // A new planet is placed on a position from 4 to 12, so 12 is the minimum.
  {
    key: 'positions',
    label: 'Positionen je System',
    explain: {
      text: 'Wie viele Planetenpositionen jedes System hat. Die Position danach ist die Expeditionsposition; sie wandert mit. Eine Flotte, die zur alten Expeditionsposition fliegt, findet dort bei der Ankunft kein passendes Ziel mehr. Senken lässt sich der Wert nur bis zur höchsten Position, auf der ein Planet liegt.',
      rows: [
        {
          label: () => 'Expeditionsposition',
          cell: ({ u }) => number(expeditionPosition(u)),
        },
      ],
    },
    min: 12,
    max: 20,
    def: 15,
    size: 'p',
  },
  {
    key: 'baseStore',
    label: 'Grundlager je Rohstoff',
    explain: {
      text: 'Das Lager jedes Rohstoffs, bevor ein Speicher gebaut ist; jede Stufe eines Speichers legt darauf etwas drauf. Wird der Wert gesenkt, bleibt ein Vorrat über der neuen Grenze erhalten, wächst aber nicht weiter.',
      rows: STORE_LEVELS.map((level) => ({
        label: (name) => `Lager bei ${name(STORE)} Stufe ${level}`,
        cell: ({ u }) => number(capOf(level, u)),
      })),
      own: true,
    },
    min: 10000,
    max: 10000000,
    def: 100000,
  },
  {
    key: 'maxReports',
    label: 'Berichte je Spieler',
    explain: {
      text: 'Wie viele Berichte jeder Spieler behält; kommt ein neuer dazu, fällt der älteste weg. Wird der Wert gesenkt, kürzt das Spiel die Berichte eines Spielers erst bei seinem nächsten Bericht.',
    },
    min: 10,
    max: 500,
    def: 60,
  },
  {
    key: 'startMetal',
    label: 'Start-Adamant',
    explain: {
      text: 'Wie viel davon ein neuer Heimatplanet mitbringt: bei der Anmeldung und für jeden Spieler in einer neuen Runde. Bestehende Planeten ändert der Wert nicht.',
    },
    min: 0,
    max: 10000000,
    def: 500,
  },
  {
    key: 'startCrystal',
    label: 'Start-Psikristall',
    explain: {
      text: 'Wie viel davon ein neuer Heimatplanet mitbringt: bei der Anmeldung und für jeden Spieler in einer neuen Runde. Bestehende Planeten ändert der Wert nicht.',
    },
    min: 0,
    max: 10000000,
    def: 500,
  },
  {
    key: 'startDeuterium',
    label: 'Start-Promethium',
    explain: {
      text: 'Wie viel davon ein neuer Heimatplanet mitbringt: bei der Anmeldung und für jeden Spieler in einer neuen Runde. Bestehende Planeten ändert der Wert nicht.',
    },
    min: 0,
    max: 10000000,
    def: 0,
  },
  // Issue #51, D4 (owner, 2026-11-13).
  {
    key: 'extraFields',
    label: 'Zusatzfelder pro Planet',
    explain: {
      text: 'So viele Felder bekommt jeder Planet zusätzlich zu denen seines Durchmessers; Monde und Planeten ohne Grenze nicht. Wird der Wert gesenkt, kann ein Planet mehr Felder belegt haben, als er hat: Er baut dann nicht weiter.',
      rows: FIELD_SIZES.map((fields) => ({
        label: () => `Planet mit ${number(minDiameter(fields))} km`,
        cell: ({ u }) =>
          number(
            maxFields(
              { b: {}, diameter: minDiameter(fields), unlimited: false },
              u,
            )!,
          ),
      })),
      own: true,
    },
    min: 0,
    max: 100,
    def: 0,
  },
  // Issue #161 (owner, 2026-11-14): the flight time the „Endzeit“ dialog
  // offers first; the dialog may change it for one trigger only.
  {
    key: 'endzeitMinutes',
    label: 'Flugzeit der Endzeit-Gabe (Minuten)',
    explain: {
      text: 'Nur der Vorschlag im Dialog „Endzeit einläuten“: die Flugzeit der Gaben, die er zuerst anbietet. Der Dialog kann sie für ein einzelnes Auslösen ändern.',
    },
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

/**
 * The values of a preset in the tab „Universum“ (#441, owner, 2026-11-28): the
 * base values of the universe at their default, the default of version 1
 * („Standard“), and the `live` settings of the round as the preset has them.
 */
export const presetUniverse = (
  id: PresetId,
): Record<string, number | boolean> => ({
  ...Object.fromEntries(SPECS.map((s) => [s.key, s.def])),
  ...presetValues(id, true),
});

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
