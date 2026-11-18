// What the article of the Fusionssanktum adds in the Lexicanum (#285): how
// its energy grows with the level and with the Machina-Energetik, on an
// example from its rule (src/core/rates.ts). The text and the keywords are
// drafts ([V], okf/features/lexicanum-texts.md).
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';
import { fusionEnergy } from '../../core/rates.ts';

/** The level of the example, of the building and of the research. */
const EXAMPLE = 10;

const energy = (tech: number): string =>
  number(Math.round(fusionEnergy(EXAMPLE, tech)));

export const lexicon: EntryLexicon = {
  keywords: ['Strom', 'Reaktor', 'Energiemangel'],
  texts: [
    {
      text: 'Die Energie wächst mit der Stufe, und jede Stufe legt auf alles noch einen Aufschlag drauf. Die [[energy]] vergrößert diesen Aufschlag und zahlt sich deshalb umso mehr aus, je höher das Fusionssanktum steht: Auf Stufe {level} liefert es ohne Machina-Energetik {plain} Energie, mit Machina-Energetik {tech} schon {boosted}. Der Promethium-Verbrauch wächst wie die Förderung einer Mine und hängt nicht von der Forschung ab.',
      values: {
        level: number(EXAMPLE),
        plain: energy(0),
        tech: number(EXAMPLE),
        boosted: energy(EXAMPLE),
      },
    },
  ],
};
