// What the article of the Warp-Tor adds in the Lexicanum (#285): the
// cooldown after a jump by the level of the starting gate, in this
// universe. The rules are src/core/jump-gate.ts (okf/features/moons.md,
// #230); the text and the keywords are drafts ([V],
// okf/features/lexicanum-texts.md).
import { gateCooldown, gateCooldownMs } from '../../core/jump-gate.ts';
import { number } from '../../core/lexicon/parts.ts';
import type {
  Block,
  EntryLexicon,
  LexState,
} from '../../core/lexicon/types.ts';

/** The levels the text compares; the cooldown stops falling at `CAP`. */
const [FIRST, MIDDLE, HIGH] = [1, 5, 10] as const;

/** The level from which the cooldown stays the same. */
const CAP = (() => {
  let level = FIRST;
  while (gateCooldown(level + 1) < gateCooldown(level)) level++;
  return level;
})();

/** The levels of the table: the decided values of the rule. */
const LEVELS = [1, 2, 3, 4, 5, HIGH, CAP] as const;

/** The cooldown of a gate at `level` in minutes in the universe of the player. */
const minutes = (s: LexState, level: number): number =>
  gateCooldownMs(level, s.u) / 60_000;

function blocks(s: LexState): Block[] {
  return [
    {
      t: 'table',
      caption: 'Wartezeit nach einem Sprung in diesem Universum',
      head: ['Stufe des Starttors', 'Wartezeit in Minuten'],
      rows: LEVELS.map((level) => ({
        cells: [level, number(minutes(s, level))],
      })),
    },
  ];
}

export const lexicon: EntryLexicon = {
  keywords: ['Tor', 'springen', 'Teleport', 'Flotte', 'Mond'],
  texts: [
    {
      text: 'Die Wartezeit nach einem Sprung hängt von der Stufe des Starttors ab und sinkt, aber nicht gleichmäßig: Stufe {first} wartet {atFirst} Minuten, Stufe {middle} {atMiddle}, Stufe {high} nur {atHigh}. Ab Stufe {cap} wird sie nicht mehr kürzer. Diese Minuten teilt das Universum durch seine Geschwindigkeit, ein schnelleres kühlt die Tore also schneller ab; die Tabelle zeigt die Zeit in deinem Universum. Beide Tore warten gleich lang, und zwar nach dem Starttor – die Stufe des Zieltors ändert nichts daran. Der Sprung selbst geschieht sofort und kostet keinen Treibstoff; nur Schiffe springen, die Rohstoffe bleiben zurück.',
      values: {
        first: number(FIRST),
        atFirst: number(gateCooldown(FIRST)),
        middle: number(MIDDLE),
        atMiddle: number(gateCooldown(MIDDLE)),
        high: number(HIGH),
        atHigh: number(gateCooldown(HIGH)),
        cap: number(CAP),
      },
    },
  ],
  formulas: [
    {
      text: 'Wartezeit in Minuten = Minuten der Tabelle für die Stufe des Starttors ÷ Geschwindigkeit des Universums',
      fn: (level, speed) => gateCooldown(level!) / speed!,
      rule: (level, speed) =>
        gateCooldownMs(level!, { speed: speed! }) / 60_000,
      samples: [
        [1, 1],
        [5, 2],
        [10, 5],
        [15, 10],
        [20, 1],
      ],
    },
  ],
  blocks,
};
