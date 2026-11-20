// What the article „Kreuzzugs-Kartografie“ adds in the Lexicanum (#93,
// #285): the expeditions at once and the stay of each level, the words that
// find it in the search and the link to the mission it unlocks ([V],
// okf/features/lexicanum-texts.md).
import { expeditionSlots, maxStayHours } from '../../core/expedition.ts';
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

/** The level of the example in the text. */
const EXAMPLE = 9;

export const lexicon: EntryLexicon = {
  keywords: ['Expedition', 'erkunden', 'entdecken', 'Rand'],
  seeAlso: ['mission-expedition', 'rule-expeditions'],
  effect: { label: 'Expeditionen gleichzeitig', at: expeditionSlots },
  texts: [
    {
      text: 'Die Stufe bestimmt, wie viele Expeditionen gleichzeitig unterwegs sein dürfen: die Wurzel der Stufe, abgerundet; der Admin kann für die Runde zusätzliche Plätze dazugeben. Jede Expedition belegt dazu einen gewöhnlichen Flottenslot. Außerdem darf eine Expedition höchstens so viele Stunden an der Expeditionsposition bleiben, wie die Stufe hoch ist; auch die Stunden je Stufe legt der Admin für die Runde fest, und er kann bestimmen, dass das Tempo des Universums die Haltezeit teilt. Mit Stufe {level} sind es in einer Runde ohne diese Änderungen {slots} Expeditionen und bis zu {hours} Stunden.',
      values: {
        level: number(EXAMPLE),
        slots: number(expeditionSlots(EXAMPLE)),
        hours: number(maxStayHours(EXAMPLE)),
      },
    },
  ],
  formulas: [
    {
      text: 'Expeditionen gleichzeitig = Wurzel der Stufe, abgerundet',
      fn: (level) => Math.floor(Math.sqrt(level!)),
      rule: expeditionSlots,
      samples: [[1], [3], [4], [8], [9], [16], [24]],
    },
  ],
};
