// What the article of the mission „Expedition“ adds in the Lexicanum (#93,
// #285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md). The numbers come from the rules.
import { EVENT_CHANCE, maxStayHours } from '../../../core/expedition.ts';
import { number, percent } from '../../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Expedition', 'erkunden', 'entdecken', 'Abenteuer', 'Rand'],
  seeAlso: ['rule-expeditions'],
  texts: [
    {
      text: 'Am Ziel, der Expeditionsposition am Rand jedes Systems, bleibt die Flotte so viele Stunden, wie du beim Start wählst, höchstens so viele wie die Stufe deiner [[expo]] (mindestens {least}; der Admin kann die Stunden je Stufe für die Runde ändern und festlegen, dass das Tempo des Universums sie teilt). Dort lässt sich nichts besiedeln. Nach dem Aufenthalt entscheidet der Zufall, in etwa {chance} der Expeditionen bringen etwas: Rohstoffe oder Schiffe, die sich der Flotte anschließen, einen Kampf gegen Piraten oder Aliens, den Verlust der ganzen Flotte oder eine frühere oder spätere Heimkehr. Zerstörte Schiffe eines Kampfes hinterlassen ein Trümmerfeld an der Expeditionsposition, das eine Bergung einsammeln kann. Eine Expedition belegt einen Flottenslot und einen Expeditionsplatz.',
      values: {
        least: number(maxStayHours(1)),
        chance: percent(EVENT_CHANCE),
      },
    },
  ],
};
