// What the article „Sonnenkathedrale“ adds in the Lexicanum (#285): how its
// rate grows with the level, with the values of the shared growth of the
// producers (src/core/rates.ts); the text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { growthValues } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Strom', 'Licht', 'Energiemangel'],
  texts: [
    {
      text: 'Die Energie wächst schneller als die Stufe: Jede Stufe zählt einmal und legt auf alles noch {step} drauf. Die doppelte Stufe liefert deshalb mehr als das Doppelte – Stufe {high} rund {times}-mal so viel wie Stufe {low}. Der Energiebedarf der Minen wächst nach demselben Muster; die Sonnenkathedrale muss also mit ihnen Schritt halten.',
      values: growthValues,
    },
  ],
};
