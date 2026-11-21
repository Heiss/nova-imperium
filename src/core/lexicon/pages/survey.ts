// The rule page „Vermessung“ (#288, #190): what a survey of a free position
// needs, the Auspex-Wert and the tiers of the report, what each tier shows,
// the loss of the Spähschädel and how long the values of the position are
// kept. The numbers come from `src/core/survey.ts`, `flight.ts` and
// `fields.ts`; the words are a draft of Claude for the owner to check ([V],
// #288).
import { distance } from '../../flight.ts';
import {
  maxLoss,
  NEAR_FIELDS,
  NEAR_TEMP,
  orbitOf,
  type Orbit,
  SIZE_FIELDS,
  type Size,
  sizeOf,
  SURVEY_DAYS,
  surveyScore,
  TIERS,
  MAX_LOSS,
} from '../../survey.ts';
import {
  count,
  days,
  facts,
  formulas,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

const PROBES = [1, 4, 10, 40];
const LEVELS = [1, 2, 3, 5];
const SYSTEMS = [1, 5, 20, 100];
const FEW = 5;
const SOME = 4;

/** The tiers from the lowest, with the lowest score that reaches each (the rough report from 0). */
const TIER_LIST = [[0, 'rough'] as const, ...[...TIERS].reverse()];

const ORBITS: Readonly<Record<Orbit, string>> = {
  inner: 'innere Bahn, heiß',
  middle: 'mittlere Bahn, gemäßigt',
  outer: 'äußere Bahn, kalt',
};

const SIZES: Readonly<Record<Size, string>> = {
  small: 'klein',
  medium: 'mittelgroß',
  large: 'groß',
};

/** The runs of equal values of `at(i)` for i from `from` to `to`, as „a bis b“ and the value. */
function runs<T>(
  from: number,
  to: number,
  at: (i: number) => T,
): { first: number; last: number; value: T }[] {
  const out: { first: number; last: number; value: T }[] = [];
  for (let i = from; i <= to; i++) {
    const last = out[out.length - 1];
    if (last && last.value === at(i)) last.last = i;
    else out.push({ first: i, last: i, value: at(i) });
  }
  return out;
}

const span = (first: number, last: number): string =>
  first === last ? number(first) : `${number(first)} bis ${number(last)}`;

const whatSection = (): PageSection =>
  section(
    'what',
    'Was eine Vermessung ist',
    say(
      'Mit einer [[mission-survey|Vermessung]] erfährst du vor der Landnahme, was an einer freien Position auf dich wartet. Dafür fliegen nur [[probe|Spähschädel]], und der Auftrag braucht die [[carto|Auspex-Kartographie]], mindestens die erste Stufe; ohne sie ist er nicht zu haben. Die Flotte belegt wie jede Flotte einen Flottenslot und fliegt nach der Messung heim. Ist die Position bei der Ankunft nicht mehr frei oder nach einer aufgegebenen Kolonie noch gesperrt, kehrt sie um.',
    ),
    say(
      'Die Werte der Position, ihren Durchmesser und ihre Temperatur, bekommt sie bei der ersten Vermessung, die einen Bericht bringt, nach denselben Regeln wie eine neue Kolonie ([[rule-planets]]). Sie bleiben {days} erhalten, gezählt ab dieser ersten Vermessung; eine weitere Vermessung beginnt die Zeit nicht neu. Wird die Position in dieser Zeit besiedelt, bekommt die Kolonie genau diese Werte. Sonst werden Werte und Berichte danach gelöscht, und eine neue Vermessung würfelt neue. Gehen die Spähschädel verloren, gibt es keinen Bericht und die Position bekommt keine Werte.',
      { days: days(SURVEY_DAYS) },
    ),
  );

/** What each tier of the report shows, as words. */
const tierText = (tier: string): string => {
  switch (tier) {
    case 'rough':
      return `Nur, was sich von der Position erraten lässt: der Planetentyp, die Spanne der Felder an dieser Position, die Temperatur um einen Mittelwert, die Bahn und eine Größe mit dem Zusatz vermutlich. Der Bericht ist als ungenau markiert.`;
    case 'near':
      return `Dazu die Felder des Planeten, um ${percent(NEAR_FIELDS)} nach oben und unten, und seine höchste Temperatur, um ${number(NEAR_TEMP)} °C nach oben und unten. Das Fenster behält seine Breite, liegt aber zufällig verschoben; der wahre Wert liegt immer darin.`;
    case 'exact':
      return 'Die Felder und die höchste Temperatur des Planeten genau.';
    default:
      return 'Alles, was über den Planeten bekannt ist: Temperatur, Durchmesser, Felder im Vergleich mit dem Durchschnitt der Position, Planetentyp, Promethium-Faktor, Energie eines Sonnenreliquiars und Vor- und Nachteile als Stichworte.';
  }
};

const reportSection = (): PageSection =>
  section(
    'report',
    'Auspex-Wert und Bericht',
    say(
      'Wie viel der Bericht zeigt, hängt vom Auspex-Wert der Vermessung ab. Jeder Spähschädel zählt einmal, jede Stufe der Auspex-Kartographie doppelt. Je höher der Auspex-Wert, desto mehr steht im Bericht; die Liste nennt, was ab welchem Wert dazukommt. Gezählt werden die Spähschädel, die ankommen, und die Stufe bei der Ankunft.',
    ),
    formulas({
      text: 'Auspex-Wert = Spähschädel + 2 · Stufe der Auspex-Kartographie',
      fn: (probes, level) => probes! + 2 * level!,
      rule: surveyScore,
      samples: [
        [1, 1],
        [4, 0],
        [10, 3],
        [40, 5],
      ],
    }),
    table(
      'Auspex-Wert nach Spähschädeln und Stufe der Auspex-Kartographie',
      ['Spähschädel', ...LEVELS.map((l) => `Stufe ${number(l)}`)],
      PROBES.map((n) => [n, ...LEVELS.map((l) => surveyScore(n, l))]),
    ),
    facts(
      TIER_LIST.map(([min, tier], i) => [
        i === 0 ? `Unter ${number(TIER_LIST[1]![0])}` : `Ab ${number(min)}`,
        tierText(tier),
      ]),
    ),
  );

const positionSection = (s: LexState): PageSection =>
  section(
    'position',
    'Was der grobe Bericht von der Position sagt',
    say(
      'Der grobe Bericht nennt die Bahn und damit die Temperatur der Position und schätzt die Größe. Die Bahn ergibt sich aus der Position im System: ein Fünftel der Positionen liegt innen, drei Fünftel in der Mitte, ein Fünftel außen. Die Größe richtet sich nach dem Durchschnitt der Felder an der Position, in drei gleich breiten Teilen der Spanne aller Positionen.',
    ),
    table(
      'Bahn nach der Position in diesem Universum',
      ['Positionen', 'Bahn'],
      runs(1, s.u.positions, (p) => orbitOf(p, s.u.positions)).map((r) => [
        span(r.first, r.last),
        ORBITS[r.value],
      ]),
    ),
    table(
      'Größe nach dem Durchschnitt der Felder der Position',
      ['Felder im Durchschnitt', 'Größe'],
      runs(SIZE_FIELDS.min, SIZE_FIELDS.max, sizeOf).map((r) => [
        span(r.first, r.last),
        SIZES[r.value],
      ]),
    ),
  );

/** The highest loss chance as the page shows it: the share as a percent. */
const lossShown = (probes: number, level: number, systems: number): string =>
  percent(
    maxLoss(
      probes,
      level,
      distance({ g: 1, s: 1, p: 1 }, { g: 1, s: 1 + systems, p: 1 }),
    ),
  );

const lossFormula = (): Block =>
  formulas({
    text: 'Höchste Verlustchance in % = Spähschädel · 5 ÷ Stufe + 6 · (Entfernung ÷ 1.000)^0,8 ÷ (1 + 0,4 · Stufe), höchstens {max}',
    values: { max: percent(MAX_LOSS) },
    fn: (probes, level, dist) =>
      Math.min(
        MAX_LOSS * 100,
        (probes! * 5) / level! +
          (6 * Math.pow(dist! / 1000, 0.8)) / (1 + 0.4 * level!),
      ),
    rule: (probes, level, dist) => maxLoss(probes!, level!, dist!) * 100,
    samples: [
      [1, 1, 2795],
      [10, 3, 2700],
      [40, 2, 12200],
      [4, 5, 9000],
    ],
  });

const lossSection = (): PageSection =>
  section(
    'loss',
    'Verlust der Spähschädel',
    say(
      'Beim Eintreffen können die Spähschädel verloren gehen. Dabei wird zuerst eine Verlustchance zwischen null und dem Höchstwert ausgelost und dann einmal gewürfelt, ob die ganze Flotte verloren ist; dann gibt es keinen Bericht. Mehr Spähschädel erhöhen den Höchstwert, ein weiter Weg auch, jede Stufe der Auspex-Kartographie senkt beides. Die Entfernung wird gemessen wie bei jedem Flug ([[rule-flight]]), vom Startplaneten aus.',
    ),
    lossFormula(),
    table(
      `Höchste Verlustchance bei einem Weg von ${count(FEW, 'System', 'Systemen')}`,
      ['Spähschädel', ...LEVELS.map((l) => `Stufe ${number(l)}`)],
      PROBES.map((n) => [n, ...LEVELS.map((l) => lossShown(n, l, FEW))]),
    ),
    table(
      `Höchste Verlustchance mit ${count(SOME, 'Spähschädel', 'Spähschädeln')} nach Entfernung`,
      ['Systeme entfernt', ...LEVELS.map((l) => `Stufe ${number(l)}`)],
      SYSTEMS.map((d) => [
        count(d, 'System', 'Systeme'),
        ...LEVELS.map((l) => lossShown(SOME, l, d)),
      ]),
    ),
  );

export const page: PageDef = {
  id: 'rule-survey',
  kind: 'rule',
  title: 'Vermessung',
  line: 'Wie du eine freie Position vermisst, was der Bericht je nach Auspex-Wert zeigt und wann Spähschädel verloren gehen.',
  keywords: ['Vermessung', 'vermessen', 'Position', 'Kartographie', 'Bericht'],
  seeAlso: [
    'mission-survey',
    'carto',
    'probe',
    'mission-colonize',
    'rule-colonies',
    'rule-planets',
  ],
  sections: (s: LexState) => [
    whatSection(),
    reportSection(),
    positionSection(s),
    lossSection(),
  ],
};
