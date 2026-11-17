// What the article of the Sternennetz der Gelehrten adds in the Lexicanum
// (#285): how many other Scholarien each level links. The text and the
// keywords are drafts ([V], okf/features/lexicanum-texts.md).
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';
import { networkLab } from '../../core/research.ts';

/** Other Scholarien, each above every requirement, so the sum counts them. */
const LAB = 100;
const labs = (n: number, lab: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    lab,
    upgrading: false,
  }));
const LABS = labs(30, LAB);

const linked = (level: number): number =>
  networkLab('ifn', { id: 'here', lab: 0, upgrading: false }, LABS, level) /
  LAB;

/** The example of the text: Scholarien of one level on some planets. */
const EXAMPLE = { labs: 3, lab: 12 };
const EXAMPLE_SUM = networkLab(
  'ifn',
  { id: 'here', lab: EXAMPLE.lab, upgrading: false },
  labs(EXAMPLE.labs - 1, EXAMPLE.lab),
  EXAMPLE.labs - 1,
);

export const lexicon: EntryLexicon = {
  keywords: ['Netzwerk', 'vernetzen', 'forschen', 'Forschungszeit'],
  effect: { label: 'Weitere Scholarien', at: linked },
  texts: [
    {
      text: 'Jede Stufe nimmt ein weiteres [[lab]] deiner anderen Planeten ins Netz – die höchsten zuerst. Mitforschen darf ein Scholarium nur, wenn es selbst die Stufe hat, die die Forschung verlangt, und nicht gerade ausgebaut wird. Die Stufen der vernetzten Scholarien zählen zu der des Startplaneten dazu: {labs} Scholarien der Stufe {lab} forschen mit Stufe {level} des Sternennetzes wie eines der Stufe {sum}. Mehr Stufen, als du weitere Scholarien hast, bringen nichts.',
      values: {
        labs: number(EXAMPLE.labs),
        lab: number(EXAMPLE.lab),
        level: number(EXAMPLE.labs - 1),
        sum: number(EXAMPLE_SUM),
      },
    },
  ],
  formulas: [
    {
      text: 'Weitere Scholarien im Netz = Stufe',
      fn: (level) => level!,
      rule: linked,
      samples: [[0], [1], [3], [8]],
    },
  ],
};
