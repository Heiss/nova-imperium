// What the article of the mission „Verlegung“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['verlegen', 'umziehen', 'parken', 'sichern'],
  texts: [
    {
      text: 'Am Ziel, einem deiner eigenen Planeten, bleiben Schiffe und Ladung; einen Rückflug gibt es nicht. Dazu bekommt der Planet die Hälfte des verbrauchten Treibstoffs als Promethium gutgeschrieben.',
    },
  ],
};
