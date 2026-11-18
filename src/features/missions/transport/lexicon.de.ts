// What the article of the mission „Versorgungsflug“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['liefern', 'schicken', 'Rohstoffe', 'Handel', 'schenken'],
  texts: [
    {
      text: 'Am Ziel lädt die Flotte ihre ganze Ladung ab und fliegt leer zurück. Gehört der Planet einem anderen Spieler, erhält auch er einen Bericht über die Lieferung.',
    },
  ],
};
