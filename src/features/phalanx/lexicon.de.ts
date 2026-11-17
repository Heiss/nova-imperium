// What the article of the Auspex-Phalanx adds in the Lexicanum (#285): its
// range in systems at each level. The text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { number } from '../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../core/lexicon/types.ts';
import { phalanxRange, SCAN_COST } from '../../core/phalanx.ts';

/** The levels the text compares; the first reaches its own system only. */
const [FIRST, MIDDLE, HIGH] = [1, 3, 5] as const;

export const lexicon: EntryLexicon = {
  keywords: ['Mond', 'scannen', 'Radar', 'beobachten'],
  effect: { label: 'Reichweite', at: phalanxRange, unit: 'Systeme' },
  texts: [
    {
      text: 'Die Reichweite wächst im Quadrat: Stufe {first} erfasst nur das eigene System, Stufe {middle} reicht {atMiddle} Systeme in jede Richtung, Stufe {high} schon {atHigh}. Jede Stufe bringt also mehr dazu als die davor. Gezählt wird nur in der eigenen Galaxie und nicht über ihr Ende hinaus. Ein Scan kostet auf jeder Stufe gleich viel: {cost} Promethium.',
      values: {
        first: number(FIRST),
        middle: number(MIDDLE),
        atMiddle: number(phalanxRange(MIDDLE)),
        high: number(HIGH),
        atHigh: number(phalanxRange(HIGH)),
        cost: number(SCAN_COST.d),
      },
    },
  ],
  formulas: [
    {
      text: 'Reichweite in Systemen = Stufe² − 1',
      fn: (level) => level! * level! - 1,
      rule: phalanxRange,
      samples: [[1], [2], [5], [9]],
    },
  ],
};
