// What the article of the Kogitator-Doktrin adds in the Lexicanum (#285):
// the fleet slots of each level.
import { fleetSlots } from '../../core/flight.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

const slots = (level: number): number =>
  fleetSlots({ research: { computer: level } });

export const lexicon: EntryLexicon = {
  effect: { label: 'Flottenslots', at: slots },
  formulas: [
    {
      text: 'Flottenslots = 1 + Stufe',
      fn: (level) => 1 + level!,
      rule: slots,
      samples: [[0], [1], [4], [12]],
    },
  ],
};
