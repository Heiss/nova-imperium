// The rule page „Highscore“ (#288, #78): the categories and how they count
// their points. The numbers come from `src/core/points.ts`; the words are a
// draft of Claude for the owner to check ([V], #288).
import { POINT_COST, pointsOf } from '../../points.ts';
import { formulas, number, say, section, table } from '../say.ts';
import type { PageDef, PageSection } from '../types.ts';

const pointsSection = (): PageSection =>
  section(
    'points',
    'So zählen die Punkte',
    say(
      'Die Highscore kennt mehrere Wertungen, und jeder Spieler sieht jede: Gesamt, Gebäude, Forschung, Flotte und Verteidigung. Gebäude, Verteidigung und die Gesamtwertung zählen einen Punkt je {cost} Rohstoffe, die in sie gesteckt sind, abgerundet. Die Forschung zählt einen Punkt je erforschter Stufe und die Flotte einen Punkt je Schiff, ganz gleich, was es gekostet hat, auch Sonnenreliquiare. Die Wertungen ergeben zusammen nicht die Gesamtwertung. Reißt du eine Stufe ab, sinken deine Punkte um die Kosten dieser Stufe.',
      { cost: number(POINT_COST) },
    ),
    formulas({
      text: 'Punkte = ⌊verbaute Rohstoffe ÷ {cost}⌋',
      values: { cost: number(POINT_COST) },
      fn: (spent) => Math.floor(spent! / POINT_COST),
      rule: pointsOf,
      samples: [[0], [999], [1000], [123456]],
    }),
    table(
      'Wie jede Wertung zählt',
      ['Wertung', 'Zählt'],
      [
        [
          'Gesamt',
          `ein Punkt je ${number(POINT_COST)} Rohstoffe in Gebäuden, Forschung, Schiffen und Verteidigung`,
        ],
        ['Gebäude', `ein Punkt je ${number(POINT_COST)} Rohstoffe in Gebäuden`],
        ['Forschung', 'ein Punkt je erforschter Stufe'],
        ['Flotte', 'ein Punkt je Schiff'],
        [
          'Verteidigung',
          `ein Punkt je ${number(POINT_COST)} Rohstoffe in Verteidigung`,
        ],
      ],
    ),
    say(
      'Die Gesamtwertung entscheidet über den [[rule-protection|Noobschutz]].',
    ),
  );

export const page: PageDef = {
  id: 'rule-highscore',
  kind: 'rule',
  title: 'Highscore',
  line: 'Wie die Punkte zählen und was die Wertungen unterscheidet.',
  keywords: ['Punkte', 'Platz', 'Rangliste', 'Wertung', 'Statistik'],
  seeAlso: ['rule-protection', 'rule-endzeit'],
  sections: () => [pointsSection()],
};
