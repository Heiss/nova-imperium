// What the article „Kreuzzugs-Kartografie“ adds in the Lexicanum (#93,
// #285): the expeditions at once and the stay of each level, the words that
// find it in the search and the link to the mission it unlocks ([V],
// okf/features/lexicanum-texts.md).
import { expeditionSlots, maxHoldHours } from '../../core/expedition.ts';
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

/** The level of the example in the text. */
const EXAMPLE = 9;

export const lexicon: EntryLexicon = {
  keywords: ['Expedition', 'erkunden', 'entdecken', 'Rand'],
  seeAlso: ['mission-expedition'],
  effect: { label: 'Expeditionen gleichzeitig', at: expeditionSlots },
  texts: [
    {
      text: 'Die Stufe bestimmt, wie viele Expeditionen gleichzeitig unterwegs sein dürfen: die Wurzel der Stufe, abgerundet. Jede Expedition belegt dazu einen gewöhnlichen Flottenslot. Außerdem darf eine Expedition höchstens so viele Stunden an der Expeditionsposition bleiben, wie die Stufe hoch ist. Mit Stufe {level} sind es {slots} Expeditionen und bis zu {hours} Stunden.',
      values: {
        level: number(EXAMPLE),
        slots: number(expeditionSlots(EXAMPLE)),
        hours: number(maxHoldHours(EXAMPLE)),
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
