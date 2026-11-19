// What the article of the Handelsposten adds in the Lexicanum (#285, #171):
// the fee at each level in this round, and the words about the limit of the
// day and its cut. The admin sets the fee, its step and the limit per round
// (owner, 2026-11-19), so the numbers come from the universe of the player
// and no number is typed into a text. The text and the keywords are drafts
// ([V], okf/features/lexicanum-texts.md).
import { number } from '../../core/lexicon/parts.ts';
import type {
  Block,
  EntryLexicon,
  LexState,
} from '../../core/lexicon/types.ts';
import { FEE, FEE_STEP, feePercent } from '../../core/market.ts';

/** The levels of the table. */
const LEVELS = [1, 2, 3, 4, 5, 10, 20] as const;

/** The fee at the level of the round of the player, in whole percent. */
const feeIn = (s: LexState, level: number): number =>
  feePercent(
    level,
    s.u.roundMarketFee ?? FEE.def,
    s.u.roundMarketFeeStep ?? FEE_STEP.def,
  );

function blocks(s: LexState): Block[] {
  return [
    {
      t: 'table',
      caption: 'Gebühr auf den Stufen in dieser Runde',
      head: ['Stufe des Handelspostens', 'Gebühr in Prozent'],
      rows: LEVELS.map((level) => ({
        cells: [level, number(feeIn(s, level))],
      })),
    },
  ];
}

export const lexicon: EntryLexicon = {
  keywords: ['tauschen', 'Handel', 'Markt'],
  texts: [
    {
      text: 'Der Handelsposten bringt auf keiner Stufe mehr Rohstoffe: Er öffnet den Marktplatz und senkt die Gebühr, die bei jedem Tausch vom Ergebnis abgezogen wird. Wie hoch sie auf der ersten Stufe ist und um wie viele Prozentpunkte jede weitere Stufe sie senkt, legt der Admin für die Runde fest; unter null fällt sie nie. Die Tabelle zeigt die Werte dieser Runde. Wie viel du für einen Rohstoff bekommst, bestimmen ebenfalls die Kurse des Admins, die sich mit jedem Tausch verschieben. Dazu kommt ein Tageslimit: Der Admin legt fest, wie viel jeder Spieler an einem Tag tauschen darf, bei null gibt es kein Limit. Wer mehr tauschen will, als vom Tag übrig ist, tauscht nur den Rest; ist nichts mehr übrig, wird der Tausch abgelehnt.',
    },
  ],
  formulas: [
    {
      text: 'Gebühr in Prozent = höchstens(Gebühr auf Stufe 1 − Abzug je Stufe · (Stufe − 1), 0)',
      fn: (level, base, step) => Math.max(0, base! - step! * (level! - 1)),
      rule: feePercent,
      samples: [
        [1, 10, 1],
        [2, 10, 1],
        [11, 10, 1],
        [12, 10, 1],
        [3, 20, 5],
        [6, 20, 5],
        [4, 0, 3],
      ],
    },
  ],
  blocks,
};
