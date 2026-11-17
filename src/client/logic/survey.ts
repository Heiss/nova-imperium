// The Vermessung in the interface (#190): the button at a free position of
// the Sternenkarte and the words of a survey report. The server stores what
// the report shows (`SurveyFindings` of src/core/survey.ts); this module
// words it like an espionage report: a rough text marked „Messung ungenau“
// (D5), narrower values, or the full table (D6).
import { PLANET_TYPE_NAMES } from '../../core/planet-type.ts';
import type {
  Compare,
  Keyword,
  Span,
  SurveyFindings,
} from '../../core/survey.ts';
import type { Coords, Levels } from '../../core/types.ts';
import { coords, esc, fmt } from './format.ts';
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

/** The rough report: what the position lets one guess (D5). */
function rough(f: SurveyFindings, c: Coords): string {
  return `<div>Vermessung ${coords(c)} – Messung ungenau. ${positionRange(f, c.p)}, Temperatur um ${f.around} °C. Planetentyp: ${PLANET_TYPE_NAMES[f.planetType]}.</div>`;
}

/** The narrowed or exact fields and temperature (D2, from score 4 and 7). */
function closer(f: SurveyFindings, c: Coords): string {
  const fields = fieldSpan(f.fields!);
  const temp = f.tier === 'near' ? `ca. ${temps(f.temp!)}` : temps(f.temp!);
  return `<div>Vermessung ${coords(c)}. ${positionRange(f, c.p)}.</div>
   <table class="mini"><tr><td>Felder</td><td>${fields}</td></tr><tr><td>Temperatur</td><td>${temp}</td></tr><tr><td>Planetentyp</td><td>${PLANET_TYPE_NAMES[f.planetType]}</td></tr></table>`;
}

/** The full report: everything known about the planet (D6). */
function full(f: SurveyFindings, c: Coords): string {
  const x = f.full!;
  const rows: [string, string][] = [
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
  ];
  return `<div>Vermessung ${coords(c)}.</div>
   <table class="mini">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
}

/** The body of a survey report in the messages. */
export function surveyBody(r: Report): string {
  const f = r as unknown as SurveyFindings & { coords: Coords };
  if (f.tier === 'full' && f.full) return full(f, f.coords);
  if (f.fields && f.temp) return closer(f, f.coords);
  return rough(f, f.coords);
}

/** Whether the Sternenkarte offers „Vermessen“: level 1 of the research and Spähschädel on the planet. */
export const canSurvey = (research: Levels, ships: Levels): boolean =>
  (research.carto ?? 0) >= 1 && (ships.probe ?? 0) > 0;
