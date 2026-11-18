// What the article „Adamant-Panzerung“ adds in the Lexicanum (#285); the text and
// the keywords are drafts ([V], okf/features/lexicanum-texts.md).
import { techPart } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  ...techPart('armor', 'maxHull', 'Struktur', 'die Struktur'),
  keywords: ['Rumpf', 'Hülle', 'Lebenspunkte', 'Kampf'],
};
