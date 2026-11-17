// The Vermessung in the interface (#190): the words of the report per tier
// and when the Sternenkarte offers it.
import { describe, expect, it } from 'vitest';
import { CENTRED, type SurveyTier, surveyFindings } from '../../core/survey.ts';
import { COMPARE, KEYWORDS, canSurvey, surveyBody } from './survey.ts';
import type { Report } from './types.ts';

const C = { g: 1, s: 42, p: 9 };

const report = (tier: SurveyTier, temp = 72, diameter = 14600): Report => ({
  id: 'r1',
  time: 1,
  type: 'survey',
  title: 'Vermessungsbericht [1:42:9]',
  coords: C,
  survey: 'v1',
  ...surveyFindings(C, { temp, diameter }, tier, CENTRED),
});

/** The text of the HTML, with its cells apart. */
const plain = (html: string): string =>
  html
    .replace(/<\/td><td>/g, ': ')
    .replace(/<\/tr>/g, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('the survey report', () => {
  it('words the rough report like an espionage report with one probe (D5)', () => {
    expect(plain(surveyBody(report('rough')))).toBe(
      'Vermessung [1:42:9] – Messung ungenau. Position 9: 150–246 Felder, Temperatur um 50 °C. Planetentyp: Dschungelplanet.',
    );
  });

  it('narrows the fields and the temperature from score 4', () => {
    expect(plain(surveyBody(report('near')))).toBe(
      'Vermessung [1:42:9]. Position 9: 150–246 Felder. Felder: ca. 170–256 | Temperatur: ca. 22 °C bis 82 °C | Planetentyp: Dschungelplanet |',
    );
  });

  it('shows the exact fields and temperature from score 7', () => {
    expect(plain(surveyBody(report('exact')))).toBe(
      'Vermessung [1:42:9]. Position 9: 150–246 Felder. Felder: 213 | Temperatur: 32 °C bis 72 °C | Planetentyp: Dschungelplanet |',
    );
  });

  it('shows the full table from score 10 (D6)', () => {
    expect(plain(surveyBody(report('full')))).toBe(
      [
        'Vermessung [1:42:9].',
        'Temperatur: 32 °C bis 72 °C |',
        'Durchmesser: 14.600 km |',
        'Felder: 213 (Position 9: 150–246, Durchschnitt 198) – überdurchschnittlich |',
        'Planetentyp: Dschungelplanet |',
        'Promethium-Faktor: ×1,14 |',
        'Energie je Sonnenreliquiar: 38 |',
        'Vorteile: viele Felder, viel Sonnenreliquiar-Energie |',
        'Nachteile: schwacher Promethium-Faktor |',
      ].join(' '),
    );
    const cool = plain(surveyBody(report('full', 50, 14072)));
    expect(cool).toContain('Durchschnitt 198) – durchschnittlich |');
    expect(cool).toContain('Vorteile: keine | Nachteile: keine |');
  });

  it('has a word for every keyword and comparison', () => {
    expect(Object.keys(KEYWORDS).sort()).toEqual(
      [
        'fewFields',
        'goodFactor',
        'littleEnergy',
        'manyFields',
        'muchEnergy',
        'weakFactor',
      ].sort(),
    );
    expect(COMPARE).toEqual({
      above: 'überdurchschnittlich',
      average: 'durchschnittlich',
      below: 'unterdurchschnittlich',
    });
    const cold = plain(surveyBody(report('full', 30, 12000)));
    expect(cold).toContain('– unterdurchschnittlich');
    expect(cold).toContain('Vorteile: guter Promethium-Faktor |');
    expect(cold).toContain(
      'Nachteile: wenige Felder, wenig Sonnenreliquiar-Energie |',
    );
  });
});

describe('„Vermessen“ in the Sternenkarte', () => {
  it('needs level 1 of Auspex-Kartographie and a Spähschädel on the planet', () => {
    expect(canSurvey({ carto: 1 }, { probe: 1 })).toBe(true);
    expect(canSurvey({ carto: 4 }, { probe: 9, sc: 1 })).toBe(true);
    expect(canSurvey({}, { probe: 1 })).toBe(false);
    expect(canSurvey({ carto: 0 }, { probe: 1 })).toBe(false);
    expect(canSurvey({ carto: 1 }, {})).toBe(false);
    expect(canSurvey({ carto: 1 }, { probe: 0 })).toBe(false);
  });
});
