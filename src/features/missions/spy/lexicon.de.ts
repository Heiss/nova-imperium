// What the article of the mission „Auspex-Erkundung“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['ausspähen', 'auskundschaften', 'Gegner', 'Bericht'],
  texts: [
    {
      text: 'Am Ziel entsteht ein Auspex-Bericht: die Rohstoffe immer, alles Weitere je nach Auspex-Wert (siehe [[spy]]). Der Verteidiger erfährt, dass er erkundet wurde und von wo.',
    },
  ],
};
