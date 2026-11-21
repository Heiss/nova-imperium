// The Vermessung in the interface (#190): the button at a free position of
// the Sternenkarte and the words of a survey report. The server stores what
// the report shows (`SurveyFindings` of src/core/survey.ts); this module
// words it like an espionage report: a rough text marked „Messung ungenau“
// (D5), narrower values, or the full table (D6).
import { PLANET_TYPE_NAMES } from '../../core/planet-type.ts';
import type {
  Compare,
  Keyword,
  Orbit,
  Size,
  Span,
  SurveyFindings,
} from '../../core/survey.ts';
import type { Coords, Levels } from '../../core/types.ts';
import { coords, fmt } from './format.ts';
import type { Report } from './types.ts';

/** The keywords of benefits and drawbacks (D6); [V] except the owner's examples. */
export const KEYWORDS: Readonly<Record<Keyword, string>> = {
  manyFields: 'viele Felder',
  fewFields: 'wenige Felder',
  goodFactor: 'guter Promethium-Faktor',
  weakFactor: 'schwacher Promethium-Faktor',
  muchEnergy: 'viel Sonnenreliquiar-Energie',
  littleEnergy: 'wenig Sonnenreliquiar-Energie',
};

/** The fields against the average of the position (D6). */
export const COMPARE: Readonly<Record<Compare, string>> = {
  above: 'überdurchschnittlich',
  average: 'durchschnittlich',
  below: 'unterdurchschnittlich',
};

/** The temperature and the orbit of the position, as the rough report names them (D5). */
export const ORBIT: Readonly<Record<Orbit, { temp: string; orbit: string }>> = {
  inner: { temp: 'Heißer', orbit: 'inneren' },
  middle: { temp: 'Gemäßigter', orbit: 'mittleren' },
  outer: { temp: 'Kalter', orbit: 'äußeren' },
};

/** The size the position lets one guess (D5). */
export const SIZE: Readonly<Record<Size, string>> = {
  small: 'klein',
  medium: 'mittelgroß',
  large: 'groß',
};

/** The owner's sentence of D5: „Gemäßigter Planet in der mittleren Bahn, vermutlich groß.“ */
const guess = (f: SurveyFindings): string =>
  `${ORBIT[f.orbit].temp} Planet in der ${ORBIT[f.orbit].orbit} Bahn, vermutlich ${SIZE[f.size]}.`;

/** A number with German decimals, at most two („182,5“, „1,14“). */
const num = (n: number): string =>
  n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** The planet spans 40 °C below its maximum temperature (the overview). */
const temps = (t: Span): string => `${t.min - 40} °C bis ${t.max} °C`;

const fieldSpan = (f: Span): string =>
  f.min === f.max ? fmt(f.min) : `ca. ${fmt(f.min)}–${fmt(f.max)}`;

/** The field range of the position, as the rough report names it. */
const positionRange = (f: SurveyFindings, p: number): string =>
  `Position ${p}: ${fmt(f.range.min)}–${fmt(f.range.max)} Felder`;

const list = (words: Keyword[]): string =>
  words.length ? words.map((k) => KEYWORDS[k]).join(', ') : 'keine';

/** What a survey report shows: a line, and a table of rows unless the report is rough. */
export interface SurveyBody {
  kind: 'survey';
  head: string;
  rows: [string, string][] | null;
}

/** The rough report: what the position lets one guess (D5). */
function rough(f: SurveyFindings, c: Coords): SurveyBody {
  return {
    kind: 'survey',
    head: `Vermessung ${coords(c)} – Messung ungenau. ${guess(f)} ${positionRange(f, c.p)}, Temperatur um ${f.around} °C. Planetentyp: ${PLANET_TYPE_NAMES[f.planetType]}.`,
    rows: null,
  };
}

/** The narrowed or exact fields and temperature (D2, from score 4 and 7). */
function closer(f: SurveyFindings, c: Coords): SurveyBody {
  const fields = fieldSpan(f.fields!);
  const temp = f.tier === 'near' ? `ca. ${temps(f.temp!)}` : temps(f.temp!);
  return {
    kind: 'survey',
    head: `Vermessung ${coords(c)}. ${positionRange(f, c.p)}.`,
    rows: [
      ['Felder', fields],
      ['Temperatur', temp],
      ['Planetentyp', PLANET_TYPE_NAMES[f.planetType]],
    ],
  };
}

/** The full report: everything known about the planet (D6). */
function full(f: SurveyFindings, c: Coords): SurveyBody {
  const x = f.full!;
  return {
    kind: 'survey',
    head: `Vermessung ${coords(c)}.`,
    rows: [
      ['Temperatur', `${x.temp - 40} °C bis ${x.temp} °C`],
      ['Durchmesser', `${fmt(x.diameter)} km`],
      [
        'Felder',
        `${fmt(x.fields)} (Position ${c.p}: ${fmt(f.range.min)}–${fmt(f.range.max)}, Durchschnitt ${num(f.average)}) – ${COMPARE[x.compare]}`,
      ],
      ['Planetentyp', PLANET_TYPE_NAMES[f.planetType]],
      ['Promethium-Faktor', `×${num(x.factor)}`],
      ['Energie je Sonnenreliquiar', fmt(x.energy)],
      ['Vorteile', list(x.pros)],
      ['Nachteile', list(x.cons)],
    ],
  };
}

/** The lines and rows of a survey report in the messages. */
export function surveyReport(r: Report): SurveyBody {
  const f = r as unknown as SurveyFindings & { coords: Coords };
  if (f.tier === 'full' && f.full) return full(f, f.coords);
  if (f.fields && f.temp) return closer(f, f.coords);
  return rough(f, f.coords);
}

/** Whether the Sternenkarte offers „Vermessen“: level 1 of the research and Spähschädel on the planet. */
export const canSurvey = (research: Levels, ships: Levels): boolean =>
  (research.carto ?? 0) >= 1 && (ships.probe ?? 0) > 0;
