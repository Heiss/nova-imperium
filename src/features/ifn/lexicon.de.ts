// What the article of the Sternennetz der Gelehrten adds in the Lexicanum
// (#285): how many other Scholarien each level links.
import type { EntryLexicon } from '../../core/lexicon/types.ts';
import { networkLab } from '../../core/research.ts';

/** Other Scholarien, each above every requirement, so the sum counts them. */
const LAB = 100;
const LABS = Array.from({ length: 30 }, (_, i) => ({
  id: `p${i}`,
  lab: LAB,
  upgrading: false,
}));

const linked = (level: number): number =>
  networkLab('ifn', { id: 'here', lab: 0, upgrading: false }, LABS, level) /
  LAB;

export const lexicon: EntryLexicon = {
  effect: { label: 'Weitere Scholarien', at: linked },
  formulas: [
    {
      text: 'Weitere Scholarien im Netz = Stufe',
      fn: (level) => level!,
      rule: linked,
      samples: [[0], [1], [3], [8]],
    },
  ],
};
