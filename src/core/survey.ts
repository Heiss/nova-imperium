// Surveying a free position with Spähschädel (#190, owner's „Geklärt“ of
// 2026-11-14), used by the server: like the espionage of players, but
// harder. What the report shows is fixed by a score, the loss is random.
//
// * D2: score = probes + 2 · L, L the level of „Auspex-Kartographie“;
//   below 4 a rough report, from 4 the fields ± 20 % and the temperature
//   ± 10 °C (owner, 2026-11-17: each window keeps its width but is shifted
//   at random, the true value always inside it), from 7 the exact fields and temperature, from 10 the full
//   report.
// * D2: the loss is drawn at random between 0 and
//   min(60 %, probes · 5 % / L + 6 % · (distance / 1000)^0.8 / (1 + 0.4 · L)),
//   rolled once for the fleet; lost probes give no report (D7).
// * D5 (owner, 2026-11-17): the rough report names the orbit with its
//   temperature by the classic position bands (1–3 innere Bahn, heiß;
//   4–12 mittlere Bahn, gemäßigt; 13–15 äußere Bahn, kalt) and the size by
//   thirds of the field range 96–252 (#51), „vermutlich“.
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

/** The orbit of a position, which also names its temperature (D5). */
export type Orbit = 'inner' | 'middle' | 'outer';

/** The size a position lets one guess (D5). */
export type Size = 'small' | 'medium' | 'large';

/** The positions of the classic bands: 1–3, 4–12 and 13–15 (D5). */
export const CLASSIC_POSITIONS = 15;

/**
 * The orbit of position `p` in a system of `positions`: the classic bands
 * of 15 positions (owner, 2026-11-17); with more positions they are scaled
 * proportionally [V], a fifth inner, three fifths middle, a fifth outer.
 */
export function orbitOf(p: number, positions: number): Orbit {
  const n = Math.max(positions, CLASSIC_POSITIONS);
  if (p * 5 <= n) return 'inner';
  return p * 5 <= 4 * n ? 'middle' : 'outer';
}

/** The field range of all positions that the sizes divide into thirds (#51). */
export const SIZE_FIELDS: Span = { min: 96, max: 252 };

/** The size of `fields` by thirds of `SIZE_FIELDS`, each third with its lower end. */
export function sizeOf(fields: number): Size {
  const third = (SIZE_FIELDS.max - SIZE_FIELDS.min) / 3;
  if (fields < SIZE_FIELDS.min + third) return 'small';
  return fields < SIZE_FIELDS.min + 2 * third ? 'medium' : 'large';
}

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
  /** The orbit and with it the temperature word of the position (D5). */
  orbit: Orbit;
  /** The size the average fields of the position let one guess (D5) [V]. */
  size: Size;
  /** The fields: a window of ± 20 % from tier `near`, exact from tier `exact`. */
  fields?: Span;
  /** The maximum temperature: a window of ± 10 °C from tier `near`, exact from `exact`. */
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

/**
 * Where the true value lies in each window of tier `near`, as the share of
 * the window below it, from 0 (at its lower end) to 1 (at its upper end).
 */
export interface NearShift {
  fields: number;
  temp: number;
}

/** Both windows centred on the true value. */
export const CENTRED: NearShift = { fields: 0.5, temp: 0.5 };

/**
 * The shift of the windows of a report of tier `tier` (owner, 2026-11-17):
 * drawn once when the report is made, one draw per window [V]; the other
 * tiers have no window and draw nothing.
 */
export const nearShift = (tier: SurveyTier, rng: Rng): NearShift =>
  tier === 'near' ? { fields: rng(), temp: rng() } : CENTRED;

/**
 * The exact value, or at tier `near` a window of the width 2 · `by` with
 * the share `shift` of it below the value. The value is a whole number, so
 * rounding both ends keeps it inside.
 */
function span(
  tier: SurveyTier,
  value: number,
  by: number,
  shift: number,
): Span {
  if (tier !== 'near') return { min: value, max: value };
  const width = 2 * by;
  return {
    min: Math.round(value - width * shift),
    max: Math.round(value + width * (1 - shift)),
  };
}

/**
 * What a survey of tier `tier` shows of the position `c` in a system of
 * `positions` with its values; `shift` places the windows of tier `near`
 * (`nearShift`).
 */
export function surveyFindings(
  c: Pick<Coords, 's' | 'p'> & { positions: number },
  v: SurveyValues,
  tier: SurveyTier,
  shift: NearShift,
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
    orbit: orbitOf(c.p, c.positions),
    size: sizeOf(average),
  };
  if (tier === 'rough') return out;
  const fields = fieldsOf(v.diameter);
  out.fields = span(tier, fields, fields * 0.2, shift.fields);
  out.temp = span(tier, v.temp, 10, shift.temp);
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
