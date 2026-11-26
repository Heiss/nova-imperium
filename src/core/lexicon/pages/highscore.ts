// The rule page „Highscore“ (#288, #78, #422): the categories and how they
// count their points. The numbers come from `src/core/points.ts`; the words
// are a draft of Claude for the owner to check ([V], #288; the categories of
// #422 as drafted for the owner, 2026-11-26, 172b: „Entwurf zur Prüfung
// durch den Owner“).
import { POINT_COST, pointsOf } from '../../points.ts';
import { formulas, number, say, section, table } from '../say.ts';
import type { PageDef, PageSection } from '../types.ts';

const pointsSection = (): PageSection =>
  section(
    'points',
    'So zählen die Punkte',
    say(
      'Die Highscore kennt drei Wertungen, und jeder Spieler sieht jede: Gesamt, Wirtschaft und Militär. Die Gesamtwertung zählt einen Punkt je {cost} Rohstoffe, die in Gebäude, Forschung, Schiffe und Verteidigung gesteckt sind, abgerundet. Ob Wirtschaft und Militär nach Anzahl oder nach verbauten Rohstoffen zählen, stellt der Admin ein. Reißt du eine Stufe ab, sinken deine Punkte um die Kosten dieser Stufe.',
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
        [
          'Wirtschaft',
          `Gebäude- und Forschungsstufen und Sonnenreliquiare: je Stück einen Punkt oder ein Punkt je ${number(POINT_COST)} verbaute Rohstoffe`,
        ],
        [
          'Militär',
          `Schiffe, Verteidigungsanlagen und Raketen: je Stück einen Punkt oder ein Punkt je ${number(POINT_COST)} verbaute Rohstoffe`,
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
