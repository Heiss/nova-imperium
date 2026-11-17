// What the article of the Mondzitadelle adds in the Lexicanum (#285): the
// fields of its moon at each level. The text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { BUILD } from '../../core/catalog.ts';
import { MOON_FIELDS, maxFields, usedFields } from '../../core/fields.ts';
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

const PER_LEVEL = BUILD.moonbase?.fields ?? 0;

/** The fields one level of the Mondzitadelle takes itself. */
const OWN = usedFields({ b: { moonbase: 1 } });

const fields = (level: number): number =>
  maxFields(
    { kind: 'moon', b: { moonbase: level }, diameter: 0, unlimited: false },
    { extraFields: 0 },
  ) ?? 0;

export const lexicon: EntryLexicon = {
  keywords: ['Mond', 'Platz', 'Bauplatz', 'Basis'],
  effect: { label: 'Felder des Mondes', at: fields },
  texts: [
    {
      text: 'Ein Mond beginnt mit {start} Feld. Jede Stufe der Mondzitadelle bringt {per} Felder und belegt selbst {own} davon – für andere Gebäude bleiben je Stufe {net}. Der Gewinn ist auf jeder Stufe gleich, während die Kosten mit jeder Stufe steigen.',
      values: {
        start: number(MOON_FIELDS),
        per: number(PER_LEVEL),
        own: number(OWN),
        net: number(PER_LEVEL - OWN),
      },
    },
  ],
  formulas: [
    {
      text: 'Felder des Mondes = {start} + {per} · Stufe',
      values: { start: number(MOON_FIELDS), per: number(PER_LEVEL) },
      fn: (level) => MOON_FIELDS + PER_LEVEL * level!,
      rule: fields,
      samples: [[0], [1], [4], [10]],
    },
  ],
};
