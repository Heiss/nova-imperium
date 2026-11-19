// The limit of planets per player (#237, okf/features/colonization.md;
// owner, 2026-11-16 and 2026-11-17): the admin sets for each round how many
// ordinary planets a player may own, the home planet included (0 = no limit),
// and may add the research „Kolonialverwaltung“, which raises the limit by
// a number of planets per level. The rules are pure: the server asks them
// when a Landnahme is sent and when it arrives, the browser shows them (the
// browser is only a preview).
import type { RoundGroup, RoundSetting } from './round.ts';
import type { Levels, Universe } from './types.ts';

/** The research that raises the limit (the folder src/features/colonial). */
const RESEARCH = 'colonial';

/**
 * The most planets a player can ever own under a limit: 20 in total (owner,
 * 2026-11-17, D6). A limit above it is not possible; the research stops
 * helping where it reaches this number.
 */
export const MOST_PLANETS = 20;

/** The ranges of the three values [V], within the owner's 20 planets in total. */
export const COLONY_RANGE = {
  base: { min: 0, max: MOST_PLANETS, def: 0 },
  perLevel: { min: 1, max: MOST_PLANETS, def: 2 },
  maxLevel: { min: 0, max: MOST_PLANETS, def: 4 },
} as const;

/** The legend of the settings in the dialog „Neue Runde“ and in the universe settings. */
const COLONIES: RoundGroup = { name: 'colonies', legend: 'Planetengrenze' };

/** The words of the one rule between the settings: research needs a base limit (issue #237). */
const NEEDS_BASE =
  'Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.';

/**
 * The four settings of the limit as entries of the registry (#283, #310): one
 * fieldset, `live` (owner, 2026-11-17, D1: set in „Neue Runde“ and editable
 * during the round, X1). A round without them has no limit and no research,
 * as before [V]; the switch is a number of 1 (yes) and 0 (no), because a
 * switch of the registry cannot be live. The order numbers follow the
 * marketplace [V]. The export under this name registers them
 * (src/core/round.ts).
 */
export const roundSettings = [
  {
    kind: 'number',
    group: COLONIES,
    live: true,
    key: 'roundColonyBase',
    name: 'colonyBase',
    label:
      'Maximale Planeten ohne Forschung (0 = unbegrenzt, der Heimatplanet zählt mit)',
    order: 440,
    min: COLONY_RANGE.base.min,
    max: COLONY_RANGE.base.max,
    def: COLONY_RANGE.base.def,
  },
  {
    kind: 'number',
    group: COLONIES,
    live: true,
    key: 'roundColonyResearch',
    name: 'colonyResearch',
    label: 'Kolonieforschung aktivieren',
    order: 450,
    min: 0,
    max: 1,
    def: 0,
    choices: [
      { value: 0, label: 'Nein' },
      { value: 1, label: 'Ja' },
    ],
    refusal: NEEDS_BASE,
    agrees: (value, round) => value === 0 || round.roundColonyBase! > 0,
  },
  {
    kind: 'number',
    group: COLONIES,
    live: true,
    key: 'roundColonyPerLevel',
    name: 'colonyPerLevel',
    label: 'Zusätzliche Planeten je Forschungsstufe',
    order: 460,
    min: COLONY_RANGE.perLevel.min,
    max: COLONY_RANGE.perLevel.max,
    def: COLONY_RANGE.perLevel.def,
  },
  {
    kind: 'number',
    group: COLONIES,
    live: true,
    key: 'roundColonyMaxLevel',
    name: 'colonyMaxLevel',
    label: 'Maximale Forschungsstufe (0 = unbegrenzt erforschbar)',
    order: 470,
    min: COLONY_RANGE.maxLevel.min,
    max: COLONY_RANGE.maxLevel.max,
    def: COLONY_RANGE.maxLevel.def,
  },
] as const satisfies readonly RoundSetting[];

/** The limit of a round: the four settings by their meaning. */
export interface ColonyRules {
  /** Planets without research; 0 is no limit. */
  base: number;
  /** Whether the research raises the limit. */
  research: boolean;
  perLevel: number;
  /** The highest level of the research; 0 is no configured ceiling. */
  maxLevel: number;
}

/** The rules of the universe's round. */
export const colonyRules = (u: Universe): ColonyRules => ({
  base: u[roundSettings[0].key] as number,
  research: u[roundSettings[1].key] === 1,
  perLevel: u[roundSettings[2].key] as number,
  maxLevel: u[roundSettings[3].key] as number,
});

/** The level of the research „Kolonialverwaltung“, 0 without it. */
export const colonyLevel = (research: Levels | undefined): number =>
  research?.[RESEARCH] ?? 0;

/**
 * The most planets a player may own, or null for no limit (#237): the base
 * limit, plus the planets per level for the level of the research when the
 * round has it, never above 20. A level above the configured highest level
 * counts as that level (the research cannot be started past it either).
 */
export function planetLimit(rules: ColonyRules, level: number): number | null {
  if (rules.base === 0) return null;
  const counted = rules.maxLevel > 0 ? Math.min(level, rules.maxLevel) : level;
  const extra = rules.research ? rules.perLevel * counted : 0;
  return Math.min(MOST_PLANETS, rules.base + extra);
}

/**
 * The limit for the research a player has: the same as `planetLimit` with
 * the level read from the research.
 */
export const limitFor = (
  rules: ColonyRules,
  research: Levels | undefined,
): number | null => planetLimit(rules, colonyLevel(research));

/** What a player has against the limit: planets they own and Landnahmen on their way out. */
export interface PlanetCount {
  /** The ordinary planets they own, the home planet included; moons do not count. */
  owned: number;
  /** The colonization fleets that fly out and keep a slot until they arrive (D3). */
  flying: number;
}

/** Whether the limit leaves no room for one more colony; no limit never does. */
export const limitReached = (
  limit: number | null,
  count: PlanetCount,
): boolean => limit !== null && count.owned + count.flying >= limit;

/** Whether an arriving colony has no room: only the planets count, the arriving fleet is no reservation. */
export const arrivalBlocked = (limit: number | null, owned: number): boolean =>
  limit !== null && owned >= limit;

/**
 * The refusal of a launch at the limit (issue #237, [V] wording): the count
 * against the limit, and the way out; the research is suggested only when
 * the round has it. The count is the planets plus the colonies on their way.
 */
export const limitText = (
  limit: number,
  count: PlanetCount,
  rules: ColonyRules,
): string =>
  `Planetengrenze erreicht (${count.owned + count.flying}/${limit}). ${
    rules.research
      ? 'Erforsche Kolonialverwaltung oder gib eine Kolonie auf.'
      : 'Gib eine Kolonie auf.'
  }`;

/** The report of an arrival that found the limit reached: the fleet comes back with its ark and cargo. */
export const arrivalText = (limit: number): string =>
  `Planetengrenze erreicht (${limit}/${limit}). Deine Flotte kehrt mit der Kolonistenarche zurück.`;

/**
 * The line for the planet overview and the fleet form (issue #237, [V]
 * wording): „Planeten: 6 / 8 · Kolonialverwaltung Stufe 1“, or „Planeten: 6 ·
 * unbegrenzt“ without a limit; the research only when the round has it.
 */
export function limitLine(
  rules: ColonyRules,
  owned: number,
  level: number,
): string {
  const limit = planetLimit(rules, level);
  if (limit === null) return `Planeten: ${owned} · unbegrenzt`;
  const research = rules.research ? ` · Kolonialverwaltung Stufe ${level}` : '';
  return `Planeten: ${owned} / ${limit}${research}`;
}

/**
 * Whether the research „Kolonialverwaltung“ exists in the round: only with
 * the switch on and a limit to raise (the base is above 0 then).
 */
export const researchOffered = (rules: ColonyRules): boolean =>
  rules.research && rules.base > 0;

/**
 * Whether the research list shows an entry in the universe's round: every
 * research but the Kolonialverwaltung, which only a round with it has.
 */
export const researchListed = (key: string, u: Universe): boolean =>
  researchRefused(key, colonyRules(u), 0) !== 'off';

/**
 * Whether the next level of the research cannot be started: the round does
 * not have it, or the configured highest level is reached (a highest level
 * of 0 is no ceiling). `undefined` for any other research.
 */
export function researchRefused(
  key: string,
  rules: ColonyRules,
  level: number,
): 'off' | 'maxLevel' | undefined {
  if (key !== RESEARCH) return undefined;
  if (!researchOffered(rules)) return 'off';
  return rules.maxLevel > 0 && level >= rules.maxLevel ? 'maxLevel' : undefined;
}
