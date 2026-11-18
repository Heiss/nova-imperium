// What the article of the mission „Bergung“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Schrott', 'Wrack', 'einsammeln', 'aufräumen'],
  texts: [
    {
      text: 'Am Trümmerfeld lädt die Flotte Adamant und Psikristall ein, bis das Feld leer oder der Laderaum voll ist. Dabei zählt der Laderaum aller Schiffe, nicht nur der [[recycler|Bergungsbarken]]. War eine andere Flotte schneller, bleibt nur der Rest; ist das Feld ganz fort, kehrt die Flotte um.',
    },
  ],
};
