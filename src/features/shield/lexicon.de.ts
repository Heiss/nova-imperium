// What the article „Refraktionsfelder“ adds in the Lexicanum (#285); the text and
// the keywords are drafts ([V], okf/features/lexicanum-texts.md).
import { techPart } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  ...techPart('shield', 'maxShield', 'Schild', 'den Schild'),
  keywords: ['Schutz', 'Abwehr', 'Kampf'],
};
