// Surveying a free position with Spähschädel (#190, owner's „Geklärt“ of
// 2026-11-14), used by the server: like the espionage of players, but
// harder. What the report shows is fixed by a score, the loss is random.
//
// * D2: score = probes + 2 · L, L the level of „Auspex-Kartographie“;
//   below 4 a rough report, from 4 the fields ± 20 % and the temperature
//   ± 10 °C, from 7 the exact fields and temperature, from 10 the full
//   report.
// * D2: the loss is drawn at random between 0 and
//   min(60 %, probes · 5 % / L + 6 % · (distance / 1000)^0.8 / (1 + 0.4 · L)),
//   rolled once for the fleet; lost probes give no report (D7).
// * D1: the values of a free position are rolled at its first survey with
//   the rules of a new colony and kept for 30 days unless it is colonized.
import type { Rng } from './battle.ts';
import { fieldRange, fieldsOf } from './fields.ts';
import { type PlanetType, planetType } from './planet-type.ts';
import { satEnergy, tempFactor } from './rates.ts';
import type { Coords } from './types.ts';

/** How much a survey report shows, from rough to full (D2). */
export type SurveyTier = 'rough' | 'near' | 'exact' | 'full';

/** The lowest score of each tier above the rough report, highest first. */
const TIERS: readonly (readonly [number, SurveyTier])[] = [
  [10, 'full'],
  [7, 'exact'],
  [4, 'near'],
];

/** Score of a survey: probes + 2 · L (D2). */
export const surveyScore = (probes: number, level: number): number =>
  probes + 2 * level;

/** The tier a score reaches; below 4 the rough report. */
export const surveyTier = (score: number): SurveyTier =>
  TIERS.find(([min]) => score >= min)?.[1] ?? 'rough';

/** The highest loss chance of a survey, 60 % (D2). */
export const MAX_LOSS = 0.6;

/**
 * The highest loss chance of a survey with `probes` at `level` over
 * `distance` (`distance()` of flight.ts), as a fraction; the chance itself
 * is drawn between 0 and it. Without the research the mission cannot fly,
 * so a level below 1 gives the highest chance.
 */
export function maxLoss(
  probes: number,
  level: number,
  distance: number,
): number {
  if (level < 1) return MAX_LOSS;
  const own = (probes * 0.05) / level;
  const far = (0.06 * Math.pow(distance / 1000, 0.8)) / (1 + 0.4 * level);
  return Math.min(MAX_LOSS, own + far);
}

/**
 * Whether the probes are lost: the chance is drawn between 0 and
 * `maxLoss`, then rolled once for the whole fleet.
 */
export const surveyLost = (max: number, rng: Rng): boolean => {
  const chance = rng() * max;
  return rng() < chance;
};

/** Days the values and reports of a survey are kept if nobody colonizes the position (D1). */
export const SURVEY_DAYS = 30;

/** The middle of the maximum temperature at a position: 130 − (p − 1) · 10. */
export const positionTemp = (p: number): number => 130 - (p - 1) * 10;

/** The maximum temperature of a new planet at position `p`: ± 10 around the middle. */
export const rollTemp = (p: number, rng: Rng): number =>
  Math.round(positionTemp(p) + (rng() * 20 - 10));

/** The stored values of a surveyed free position (D1). */
export interface SurveyValues {
  temp: number;
  diameter: number;
}

/** A range of whole numbers, both ends included. */
export interface Span {
  min: number;
  max: number;
}

/** Fields compared with the average of the position. */
export type Compare = 'above' | 'average' | 'below';

/** A benefit or a drawback of a planet, as a keyword (D6). */
export type Keyword =
  | 'manyFields'
  | 'fewFields'
  | 'goodFactor'
  | 'weakFactor'
  | 'muchEnergy'
  | 'littleEnergy';

/** Everything known about the planet: the full report (D6). */
interface FullFindings {
  /** The maximum temperature; the planet spans 40 °C below it. */
  temp: number;
  diameter: number;
  fields: number;
  compare: Compare;
  /** The yield factor of the Promethium-Raffinerie. */
  factor: number;
  /** Energy of one Sonnenreliquiar. */
  energy: number;
  pros: Keyword[];
  cons: Keyword[];
}

/** What a survey report holds; the browser words it. */
export interface SurveyFindings {
  tier: SurveyTier;
  /** The planet type follows from the coordinates (#52). */
  planetType: PlanetType;
  /** The field range of the position (#51) and its average. */
  range: Span;
  average: number;
  /** The middle of the maximum temperature at the position (D5). */
  around: number;
  /** The fields: ± 20 % from tier `near`, exact from tier `exact`. */
  fields?: Span;
  /** The maximum temperature: ± 10 °C from tier `near`, exact from `exact`. */
  temp?: Span;
  full?: FullFindings;
}

/** How the fields compare with the average of the position. */
const compare = (fields: number, average: number): Compare =>
  fields > average ? 'above' : fields < average ? 'below' : 'average';

/**
 * Benefits and drawbacks against the position [V]: more or fewer fields
 * than its average; cooler than its middle temperature gives the better
 * Promethium factor and less energy of a Sonnenreliquiar, warmer the
 * reverse.
 */
function keywords(
  fields: Compare,
  temp: number,
  middle: number,
): { pros: Keyword[]; cons: Keyword[] } {
  const pros: Keyword[] = [];
  const cons: Keyword[] = [];
  if (fields === 'above') pros.push('manyFields');
  if (fields === 'below') cons.push('fewFields');
  if (temp < middle) {
    pros.push('goodFactor');
    cons.push('littleEnergy');
  }
  if (temp > middle) {
    pros.push('muchEnergy');
    cons.push('weakFactor');
  }
  return { pros, cons };
}

/** The exact value, or ± `by` around it at tier `near`. */
const span = (tier: SurveyTier, value: number, by: number): Span =>
  tier === 'near'
    ? { min: Math.round(value - by), max: Math.round(value + by) }
    : { min: value, max: value };

/** What a survey of tier `tier` shows of the position `c` with its values. */
export function surveyFindings(
  c: Pick<Coords, 's' | 'p'>,
  v: SurveyValues,
  tier: SurveyTier,
): SurveyFindings {
  const range = fieldRange(c.p);
  const average = (range.min + range.max) / 2;
  const around = positionTemp(c.p);
  const out: SurveyFindings = {
    tier,
    planetType: planetType(c),
    range,
    average,
    around,
  };
  if (tier === 'rough') return out;
  const fields = fieldsOf(v.diameter);
  out.fields = span(tier, fields, fields * 0.2);
  out.temp = span(tier, v.temp, 10);
  if (tier !== 'full') return out;
  const cmp = compare(fields, average);
  out.full = {
    temp: v.temp,
    diameter: v.diameter,
    fields,
    compare: cmp,
    factor: tempFactor(v.temp),
    energy: satEnergy(v.temp),
    ...keywords(cmp, v.temp, around),
  };
  return out;
}
