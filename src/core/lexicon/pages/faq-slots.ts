// The question „Wie bekomme ich mehr Flottenslots?“ (#288): the answer, the
// steps and the player's own slots. The numbers come from
// `src/core/flight.ts` and `expedition.ts`; the words are a draft of Claude
// for the owner to check ([V], #288).
import { expeditionSlots, extraSlots } from '../../expedition.ts';
import { fleetSlots } from '../../flight.ts';
import { count, number, requires, say, section, steps, table } from '../say.ts';
import type { PageDef } from '../types.ts';

const LEVELS = [0, 1, 2, 5, 10, 15];

const page: PageDef = {
  id: 'faq-slots',
  kind: 'question',
  title: 'Wie bekomme ich mehr Flottenslots?',
  line: 'Mit der Kogitator-Doktrin: Jede Stufe bringt einen Slot dazu.',
  keywords: ['Flottenslots', 'Slots', 'gleichzeitig', 'Flotten', 'Kogitator'],
  seeAlso: ['computer', 'rule-flight', 'expo'],
  sections: (s) => {
    const level = s.research.computer ?? 0;
    return [
      section(
        'answer',
        'Kurz gesagt',
        say(
          'Erforsche die [[computer|Kogitator-Doktrin]]. Ohne sie hast du einen Flottenslot, und jede Stufe bringt genau einen weiteren dazu. Die Slots zählen über alle deine Planeten zusammen: Eine Flotte belegt einen, bis sie wieder zu Hause ist. Raketen aus der Raketenkrypta brauchen keinen.',
        ),
      ),
      section(
        'steps',
        'Schritte',
        steps(
          `Baue das Gebäude, das die Kogitator-Doktrin braucht: ${requires('computer')}.`,
          'Erforsche die [[computer|Kogitator-Doktrin]] Stufe um Stufe; die Kosten steigen mit jeder Stufe, der Gewinn von einem Slot bleibt gleich.',
          'Prüfe in der Flottenansicht, wie viele Slots belegt sind.',
        ),
      ),
      section(
        'values',
        'Was dir das bringt',
        table(
          'Flottenslots nach Stufe der Kogitator-Doktrin',
          ['Stufe', 'Flottenslots'],
          LEVELS.map((l) => [l, fleetSlots({ research: { computer: l } })]),
          (i) => LEVELS[i] === level,
        ),
        {
          t: 'stand',
          text: `Dein Stand: Stufe ${number(level)} der Kogitator-Doktrin, ${count(fleetSlots({ research: s.research }), 'Flottenslot', 'Flottenslots')}.`,
        },
        say(
          'Expeditionen belegen einen gewöhnlichen Slot und zusätzlich einen Expeditionsplatz. Wie viele Plätze du hast, bestimmt die [[expo|Kreuzzugs-Kartografie]]; in dieser Runde hat der Admin {extra} zusätzliche Plätze gegeben. Mit deiner Stufe der Kreuzzugs-Kartografie hast du {places} Plätze.',
          {
            extra: number(extraSlots(s.u)),
            places: number(
              expeditionSlots(s.research.expo ?? 0, extraSlots(s.u)),
            ),
          },
        ),
      ),
    ];
  },
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 270, page };
