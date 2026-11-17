// What the article of the Mondzitadelle adds in the Lexicanum (#285): the
// fields of its moon at each level.
import { BUILD } from '../../core/catalog.ts';
import { MOON_FIELDS, maxFields } from '../../core/fields.ts';
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

const PER_LEVEL = BUILD.moonbase?.fields ?? 0;

const fields = (level: number): number =>
  maxFields(
    { kind: 'moon', b: { moonbase: level }, diameter: 0, unlimited: false },
    { extraFields: 0 },
  ) ?? 0;

export const lexicon: EntryLexicon = {
  effect: { label: 'Felder des Mondes', at: fields },
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
