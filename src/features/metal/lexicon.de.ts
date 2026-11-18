// What the article „Adamant-Tiefbohrung“ adds in the Lexicanum (#285): how its
// rate grows with the level, with the values of the shared growth of the
// producers (src/core/rates.ts); the text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { growthValues } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Erz', 'Mine', 'Bergwerk', 'fördern'],
  texts: [
    {
      text: 'Die Förderung wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch {step} drauf. Die doppelte Stufe fördert deshalb mehr als das Doppelte – Stufe {high} rund {times}-mal so viel wie Stufe {low}. Der Energiebedarf wächst im selben Maß. Die Tabelle zeigt die Förderung bei voller Energie.',
      values: growthValues,
    },
  ],
};
