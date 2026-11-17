// What the article „Psikristall-Reliquiar“ adds in the Lexicanum (#285): how the
// capacity grows, before its formula; the text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { storePart } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  ...storePart(),
  keywords: ['Lager', 'Speicher', 'voll', 'Platz'],
};
