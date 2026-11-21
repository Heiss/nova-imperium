// The Vermessung in the interface (#190): the words of the report per tier
// and when the Sternenkarte offers it.
import { describe, expect, it } from 'vitest';
import { CENTRED, type SurveyTier, surveyFindings } from '../../core/survey.ts';
import type { Coords } from '../../core/types.ts';
import {
  COMPARE,
  KEYWORDS,
  ORBIT,
  SIZE,
  canSurvey,
  surveyReport,
} from './survey.ts';
import type { Report } from './types.ts';

const C = { g: 1, s: 42, p: 9 };

const report = (
  tier: SurveyTier,
  temp = 72,
  diameter = 14600,
  at: Coords = C,
): Report => ({
  id: 'r1',
  time: 1,
  type: 'survey',
  title: `Vermessungsbericht [${at.g}:${at.s}:${at.p}]`,
  coords: at,
  survey: 'v1',
  ...surveyFindings(
    { ...at, positions: 15 },
    { temp, diameter },
    tier,
    CENTRED,
  ),
});

/** The line of the report, then each row as „label: value |“. */
const plain = (r: Report): string => {
  const body = surveyReport(r);
  return [body.head, ...(body.rows ?? []).map(([k, v]) => `${k}: ${v} |`)].join(
    ' ',
  );
};

describe('the survey report', () => {
  it('words the rough report like an espionage report with one probe (D5)', () => {
    expect(plain(report('rough'))).toBe(
      'Vermessung [1:42:9] – Messung ungenau. Gemäßigter Planet in der mittleren Bahn, vermutlich mittelgroß. Position 9: 150–246 Felder, Temperatur um 50 °C. Planetentyp: Dschungelplanet.',
    );
  });

  it('names the orbit, its temperature and the size of every band (owner, 2026-11-17)', () => {
    const at = (p: number) =>
      plain(report('rough', 72, 14600, { g: 1, s: 42, p }));
    expect(at(2)).toContain(
      'Messung ungenau. Heißer Planet in der inneren Bahn, vermutlich klein. Position 2',
    );
    expect(at(8)).toContain(
      'Messung ungenau. Gemäßigter Planet in der mittleren Bahn, vermutlich groß. Position 8',
    );
    expect(at(14)).toContain(
      'Messung ungenau. Kalter Planet in der äußeren Bahn, vermutlich klein. Position 14',
    );
    expect(ORBIT).toEqual({
      inner: { temp: 'Heißer', orbit: 'inneren' },
      middle: { temp: 'Gemäßigter', orbit: 'mittleren' },
      outer: { temp: 'Kalter', orbit: 'äußeren' },
    });
    expect(SIZE).toEqual({
      small: 'klein',
      medium: 'mittelgroß',
      large: 'groß',
    });
    // Only the rough report names them.
    expect(plain(report('near'))).not.toContain('Bahn');
  });

  it('narrows the fields and the temperature from score 4', () => {
    expect(plain(report('near'))).toBe(
      'Vermessung [1:42:9]. Position 9: 150–246 Felder. Felder: ca. 170–256 | Temperatur: ca. 22 °C bis 82 °C | Planetentyp: Dschungelplanet |',
    );
  });

  it('shows the exact fields and temperature from score 7', () => {
    expect(plain(report('exact'))).toBe(
      'Vermessung [1:42:9]. Position 9: 150–246 Felder. Felder: 213 | Temperatur: 32 °C bis 72 °C | Planetentyp: Dschungelplanet |',
    );
  });

  it('shows the full table from score 10 (D6)', () => {
    expect(plain(report('full'))).toBe(
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
    const cool = plain(report('full', 50, 14072));
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
    const cold = plain(report('full', 30, 12000));
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
