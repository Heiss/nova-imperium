// What the article of the mission „Sturmangriff“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['angreifen', 'überfallen', 'plündern', 'Kampf', 'Krieg', 'Beute'],
  texts: [
    {
      text: 'Am Ziel kämpft die Flotte gegen die Schiffe und die Verteidigung des Planeten. Gewinnt sie, lädt sie bis zur Hälfte jedes Rohstoffs ein, soweit der Laderaum reicht. Was den Kampf übersteht, fliegt heim. Zerstörte Schiffe beider Seiten hinterlassen ein Trümmerfeld, ein Teil der zerstörten Verteidigung wird wieder aufgebaut. Beide Seiten erhalten einen Kampfbericht.',
    },
  ],
};
