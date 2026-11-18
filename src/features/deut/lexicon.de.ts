// What the article „Promethium-Raffinerie“ adds in the Lexicanum (#285): how its
// rate grows with the level, with the values of the shared growth of the
// producers (src/core/rates.ts); the text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { growthValues } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Treibstoff', 'Sprit', 'Mine', 'tanken'],
  texts: [
    {
      text: 'Der Ausstoß wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch {step} drauf. Die doppelte Stufe bringt deshalb mehr als das Doppelte – Stufe {high} rund {times}-mal so viel wie Stufe {low}. Dazu kommt die Temperatur: Je kälter der Planet, desto mehr Promethium, und jedes Grad weniger bringt gleich viel dazu. Der Energiebedarf wächst im selben Maß wie der Ausstoß. Die Tabelle zeigt den Ausstoß bei voller Energie auf diesem Planeten.',
      values: growthValues,
    },
  ],
};
