// What the article of the mission „Landnahme“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['siedeln', 'besiedeln', 'Kolonie', 'Planet'],
  texts: [
    {
      text: 'Am Ziel gründet eine [[colony]] die neue Kolonie und bleibt dort; die Ladung der Flotte wird der erste Vorrat der Kolonie. Alle anderen Schiffe fliegen leer zurück. Ist die Position inzwischen besetzt, kehrt die ganze Flotte mit ihrer Ladung um.',
    },
  ],
};
