// What the article of the Auspex-Phalanx adds in the Lexicanum (#285): its
// range in systems at each level.
import type { EntryLexicon } from '../../core/lexicon/types.ts';
import { phalanxRange } from '../../core/phalanx.ts';

export const lexicon: EntryLexicon = {
  effect: { label: 'Reichweite', at: phalanxRange, unit: 'Systeme' },
  formulas: [
    {
      text: 'Reichweite in Systemen = Stufe² − 1',
      fn: (level) => level! * level! - 1,
      rule: phalanxRange,
      samples: [[1], [2], [5], [9]],
    },
  ],
};
