// What the article of the Handelsposten adds in the Lexicanum (#285, #171):
// the fee at each level. The text and the keywords are drafts ([V],
// okf/features/lexicanum-texts.md); every number in the text is a value
// from the rules of src/core/market.ts.
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';
import { FEE_BASE, FEE_STEP, FEE_UNIT, feeAt } from '../../core/market.ts';

/** A fee in thousandths as percent. */
const inPercent = (thousandths: number): number =>
  (thousandths * 100) / FEE_UNIT;

/** The fee at a level in percent. */
const percent = (level: number): number => inPercent(feeAt(level));

/** The first level without a fee. */
const FREE = Math.ceil(FEE_BASE / FEE_STEP) + 1;

export const lexicon: EntryLexicon = {
  keywords: ['tauschen', 'Handel', 'Markt'],
  effect: { label: 'Gebühr', at: percent, unit: '%' },
  texts: [
    {
      text: 'Der Handelsposten bringt auf keiner Stufe mehr Rohstoffe: Er öffnet den Marktplatz und senkt die Gebühr. Auf Stufe {first} beträgt sie {fee} Prozent des Ergebnisses, jede weitere Stufe nimmt {step} Prozentpunkt davon ab, und ab Stufe {free} entfällt sie ganz. Wie viel du für einen Rohstoff bekommst, bestimmen die Kurse des Admins, die sich mit jedem Tausch verschieben.',
      values: {
        first: number(1),
        fee: number(percent(1)),
        step: number(inPercent(FEE_STEP)),
        free: number(FREE),
      },
    },
  ],
  formulas: [
    {
      text: 'Gebühr in Prozent = höchstens({base} − {step} · (Stufe − 1), 0)',
      values: {
        base: number(inPercent(FEE_BASE)),
        step: number(inPercent(FEE_STEP)),
      },
      fn: (level) =>
        Math.max(0, inPercent(FEE_BASE) - inPercent(FEE_STEP) * (level! - 1)),
      rule: percent,
      samples: [[1], [2], [5], [11], [20]],
    },
  ],
};
