// What the article of the Kogitator-Doktrin adds in the Lexicanum (#285):
// the fleet slots of each level. The text and the keywords are drafts ([V],
// okf/features/lexicanum-texts.md).
import { fleetSlots } from '../../core/flight.ts';
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

const slots = (level: number): number =>
  fleetSlots({ research: { computer: level } });

/** The level of the example in the text. */
const EXAMPLE = 5;

export const lexicon: EntryLexicon = {
  keywords: ['Flotten', 'gleichzeitig', 'Slots'],
  effect: { label: 'Flottenslots', at: slots },
  texts: [
    {
      text: 'Ohne die Kogitator-Doktrin hast du {base} Flottenslot. Jede Stufe bringt genau einen weiteren dazu – auf jeder Stufe gleich viel, während die Kosten mit jeder Stufe steigen. Mit Stufe {level} sind es {slots} Flotten, die gleichzeitig unterwegs sein können, über alle deine Planeten zusammen.',
      values: {
        base: number(slots(0)),
        level: number(EXAMPLE),
        slots: number(slots(EXAMPLE)),
      },
    },
  ],
  formulas: [
    {
      text: 'Flottenslots = 1 + Stufe',
      fn: (level) => 1 + level!,
      rule: slots,
      samples: [[0], [1], [4], [12]],
    },
  ],
};
