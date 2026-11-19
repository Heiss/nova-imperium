// What the article of the mission „Wache stellen“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import { HOLD_HOURS, HOLD_LIMITS } from '../../../core/holding.ts';
import { number } from '../../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['verteidigen', 'stationieren', 'beistehen', 'Gilde'],
  texts: [
    {
      text: 'Am Ziel, dem Planeten eines Gildenmitglieds oder Freundes, bleibt die Flotte für die Haltezeit, die du beim Start wählst (von {least} bis {most} Stunden), und verteidigt den Planeten in jedem Kampf zusammen mit seinem Besitzer. Danach fliegt sie heim. Wer halten darf, legt der Admin je Runde fest; den Treibstoff für die Haltezeit zahlst du beim Start. An einem Planeten halten höchstens {players} Spieler mit zusammen höchstens {fleets} Flotten.',
      values: {
        least: number(Math.min(...HOLD_HOURS)),
        most: number(Math.max(...HOLD_HOURS)),
        players: number(HOLD_LIMITS.players),
        fleets: number(HOLD_LIMITS.fleets),
      },
    },
  ],
};
