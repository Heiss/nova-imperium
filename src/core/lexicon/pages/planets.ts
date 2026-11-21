// The rule page „Planeten und Felder“ (#288): the fields of a planet, the
// size and temperature of a new colony by position, the type of a planet and
// the tearing down of a building level (#202). The numbers come from
// `src/core/fields.ts`, `survey.ts`, `planet-type.ts` and `demolition.ts`;
// the words are a draft of Claude for the owner to check ([V], #288).
import { BUILD } from '../../catalog.ts';
import {
  demolitionMoves,
  DEMOLITION_REFUND,
  refundOf,
  timeOf,
} from '../../demolition.ts';
import {
  fieldRange,
  fieldsOf,
  HOME_DIAMETER,
  maxFields,
} from '../../fields.ts';
import { PLANET_TYPE_NAMES, planetType } from '../../planet-type.ts';
import { positionTemp, rollTemp } from '../../survey.ts';
import { formulas, number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** The positions of a system, 1 to `count`. */
const positions = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => i + 1);

/** The coldest and the warmest maximum temperature a new planet at `p` can get. */
const temps = (p: number): string =>
  `${rollTemp(p, () => 0)} bis ${rollTemp(p, () => 0.999999)} °C`;

const fieldsSection = (s: LexState): PageSection =>
  section(
    'fields',
    'Größe und Felder',
    say(
      'Wie viele Gebäudestufen ein Planet fasst, hängt von seinem Durchmesser ab: Er hat so viele Felder wie das Quadrat seines Durchmessers in tausend Kilometern, abgerundet. Jede Gebäudestufe belegt ein Feld; Schiffe, Verteidigung und Forschung belegen keines. Ohne freies Feld lässt sich keine weitere Gebäudestufe bauen. Jede Stufe der [[terraformer|Weltenschmiede]] schafft {gain} Felder, von denen sie selbst eines belegt, und in diesem Universum bekommt jeder Planet außerdem {extra} Zusatzfelder. Dein Heimatplanet hat immer {home} Felder.',
      {
        gain: number(BUILD.terraformer?.fields ?? 0),
        extra: number(s.u.extraFields),
        home: number(fieldsOf(HOME_DIAMETER)),
      },
    ),
    formulas({
      text: 'Felder = ⌊(Durchmesser in km ÷ 1.000)²⌋ + Zusatzfelder + {gain} · Stufe der Weltenschmiede',
      values: { gain: number(BUILD.terraformer?.fields ?? 0) },
      fn: (diameter, extra, level) =>
        Math.floor((diameter! / 1000) ** 2) +
        extra! +
        (BUILD.terraformer?.fields ?? 0) * level!,
      rule: (diameter, extra, level) =>
        maxFields(
          {
            b: { terraformer: level! },
            diameter: diameter!,
            unlimited: false,
          },
          { extraFields: extra! },
        )!,
      samples: [
        [12800, 0, 0],
        [9500, 4, 3],
        [15870, 10, 12],
        [8944, 0, 1],
      ],
    }),
  );

const positionSection = (s: LexState): PageSection =>
  section(
    'positions',
    'Neue Kolonien nach Position',
    say(
      'Eine neue Kolonie bekommt zuerst eine zufällige Zahl von Feldern aus dem Bereich ihrer Position und dann einen Durchmesser, der dazu passt. Die Tabelle zeigt den Bereich je Position, dazu die Temperatur und den Typ des Planeten.',
    ),
    table(
      'Felder, Temperatur und Typ einer neuen Kolonie nach Position',
      [
        'Position',
        'Felder',
        'Höchsttemperatur',
        'Typ im ungeraden System',
        'Typ im geraden System',
      ],
      positions(s.u.positions).map((p) => {
        const range = fieldRange(p);
        return [
          p,
          `${number(range.min)} bis ${number(range.max)}`,
          temps(p),
          PLANET_TYPE_NAMES[planetType({ s: 1, p })],
          PLANET_TYPE_NAMES[planetType({ s: 2, p })],
        ];
      }),
    ),
    say(
      'Die Temperatur sinkt mit jeder Position nach außen gleichmäßig; der Wert einer Kolonie liegt um einen festen Spielraum um die Mitte ihrer Position. Je kälter der Planet, desto mehr Promethium fördert die [[deut|Promethium-Raffinerie]]. Der Typ eines Planeten folgt allein aus seiner Position und ist nur ein Aussehen; er ändert keinen Wert.',
    ),
    formulas({
      text: 'Mitte der Höchsttemperatur in °C = 130 − (Position − 1) · 10',
      fn: (p) => 130 - (p! - 1) * 10,
      rule: positionTemp,
      samples: [[1], [4], [9], [15]],
    }),
  );

const demolishSection = (s: LexState): PageSection =>
  section(
    'demolish',
    'Eine Stufe zurückbauen',
    say(
      'Ein Gebäude lässt sich um eine Stufe zurückbauen, jeweils eine Stufe je Auftrag. Der Rückbau läuft in der Bauschleife des Planeten und nimmt einen Teil der Bauzeit der Stufe in Anspruch. Ist der Erstattungsfaktor der Runde positiv, bekommst du diesen Anteil der Kosten der Stufe zurück, sobald der Rückbau fertig ist. Ist er negativ, kostet der Rückbau diesen Anteil schon beim Start, und du musst ihn bezahlen können. In dieser Runde beträgt der Faktor {refund} und der Rückbau {time} der Bauzeit. Der Admin legt beides für die Runde fest.',
      {
        refund: `${number(refundOf(s.u))} %`,
        time: `${number(timeOf(s.u))} %`,
      },
    ),
    formulas(
      {
        text: 'Erstattung bei positivem Faktor = ⌊Kosten der Stufe · Faktor ÷ 100⌋, nach dem Rückbau',
        fn: (cost, refund) => Math.floor((cost! * refund!) / 100),
        rule: (cost, refund) => demolitionMoves([cost!, 0, 0], refund!).back[0],
        samples: [
          [1000, 50],
          [48000, 100],
          [333, 1],
        ],
      },
      {
        text: 'Kosten bei negativem Faktor = ⌊Kosten der Stufe · |Faktor| ÷ 100⌋, beim Start',
        fn: (cost, refund) => Math.floor((cost! * -refund!) / 100),
        rule: (cost, refund) => demolitionMoves([cost!, 0, 0], refund!).pay[0],
        samples: [
          [1000, -50],
          [48000, -100],
          [333, -1],
        ],
      },
    ),
    say(
      'Der Faktor reicht von {low} bis {high}. Zurückbauen geht nicht auf einem Mond, nicht ohne Stufe und nicht, solange die Bauschleife des Planeten läuft. Auch nicht, solange das Gebäude gebraucht wird, also nicht, wenn die Schiffsschmiede Aufträge hat oder das Scholarium forscht, und nicht, wenn danach mehr Felder belegt wären, als der Planet hat, wie bei der Weltenschmiede. Die Raketenkrypta lässt sich nicht zurückbauen, wenn ihre Plätze danach für die Raketen nicht mehr reichen, die Raketen in der Schiffsschmiede mitgezählt; dann baust du erst Raketen ab. Die Punkte der Highscore sinken um die Kosten der zurückgebauten Stufe.',
      {
        low: `${number(DEMOLITION_REFUND.min)} %`,
        high: `${number(DEMOLITION_REFUND.max)} %`,
      },
    ),
  );

export const page: PageDef = {
  id: 'rule-planets',
  kind: 'rule',
  title: 'Planeten und Felder',
  line: 'Wie viele Gebäudestufen ein Planet fasst, wie groß und warm eine neue Kolonie wird und wie du eine Stufe zurückbaust.',
  keywords: ['Planet', 'Felder', 'Platz', 'Temperatur', 'abreißen'],
  seeAlso: ['terraformer', 'deut', 'rule-colonies', 'rule-moons'],
  sections: (s) => [fieldsSection(s), positionSection(s), demolishSection(s)],
};
