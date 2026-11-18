// What the article of the Auspex-Lehre adds in the Lexicanum (#285): the
// Auspex-Wert of a report, what it shows, how many Spähschädel it takes and
// the chance of the Auspex-Abwehr, computed from src/core/spy.ts and
// src/core/espionage.ts. The texts are those of the design study of #285
// (#287, [V]); the paragraph and the formula of the Auspex-Abwehr are a [V]
// of Claude for the owner to check (#175); every number comes from the rules.
import {
  counterMax,
  MAX_CHANCE,
  PROBE_DIVISOR,
  SHIP_DIVISOR,
} from '../../core/espionage.ts';
import { number } from '../../core/lexicon/parts.ts';
import type {
  Block,
  EntryLexicon,
  LexState,
} from '../../core/lexicon/types.ts';
import {
  probesFor,
  SPY_LEVELS,
  type SpyPart,
  spyScore,
} from '../../core/spy.ts';

/** The parts of a report, as the report names them. */
const PARTS: Readonly<Record<SpyPart, string>> = {
  ships: 'Flotte',
  def: 'Verteidigung',
  b: 'Gebäude',
  r: 'Forschung',
};

/** The lead at which a report shows everything: the last level. */
const ALL = SPY_LEVELS[SPY_LEVELS.length - 1]![0];

const LEADS = [-3, -2, -1, 0, 1, 2, 3];
const PROBES = [1, 4, 12, 40];
const FLEETS = [0, 10, 100, 1000];

const signed = (lead: number): string =>
  lead > 0 ? `+${lead}` : lead < 0 ? `−${-lead}` : 'gleich';

const leadLabel = (lead: number): string =>
  lead > 0
    ? `${signed(lead)} (du führst)`
    : lead < 0
      ? `${signed(lead)} (Ziel führt)`
      : 'gleich';

/** „Dein Stand“: own level and Spähschädel, and what they show (B5). */
function stand(s: LexState): string {
  const level = s.research.spy ?? 0;
  const probes = s.ships.probe ?? 0;
  const head = `Dein Stand: Stufe ${level} und ${number(probes)} Spähschädel.`;
  if (spyScore(probes, 0) < ALL)
    return `${head} Gegen ein Ziel mit Stufe ${level} brauchst du ${number(probesFor(ALL, 0))} für die Forschung.`;
  let lag = 1;
  while (spyScore(probes, -lag) >= ALL) lag++;
  return `${head} Gegen ein Ziel mit Stufe ${level} zeigt der Bericht alles; gegen Stufe ${level + lag} brauchst du ${number(probesFor(ALL, -lag))} für die Forschung.`;
}

/** The highest chance of the Auspex-Abwehr by probes and ships, at equal Auspex-Lehre. */
const chanceTable = (): Block => ({
  t: 'table',
  caption: 'Höchste Chance auf Auspex-Abwehr bei gleicher Auspex-Lehre',
  head: ['Schiffe am Ziel', ...PROBES.map((n) => `${number(n)} Spähschädel`)],
  rows: FLEETS.map((ships) => ({
    cells: [
      number(ships),
      ...PROBES.map(
        (probes) =>
          `${number(counterMax({ probes, ships, target: 1, spy: 1 }))} %`,
      ),
    ],
  })),
});

function blocks(s: LexState): Block[] {
  return [
    { t: 'text', text: 'Der Wert entscheidet, was der Bericht zeigt:' },
    {
      t: 'chips',
      items: [
        { label: 'immer', text: 'Rohstoffe' },
        ...SPY_LEVELS.map(([min, part]) => ({
          label: `ab ${min}`,
          text: PARTS[part],
        })),
      ],
    },
    {
      t: 'table',
      caption: 'Spähschädel, die du mindestens brauchst',
      head: [
        'Vorsprung in Auspex-Lehre',
        'Rohstoffe',
        ...SPY_LEVELS.map(([, part]) => PARTS[part]),
      ],
      rows: LEADS.map((lead) => ({
        cells: [
          leadLabel(lead),
          1,
          ...SPY_LEVELS.map(([min]) => probesFor(min, lead)),
        ],
      })),
    },
    { t: 'stand', text: stand(s) },
    chanceTable(),
    {
      t: 'text',
      text: 'Die Chance auf Auspex-Abwehr wird bei jeder [[mission-spy]] neu zwischen null und dem Höchstwert ausgelost. Mehr [[probe]] und mehr Schiffe am Ziel erhöhen ihn, eine höhere Auspex-Lehre des Ziels auch; deine eigene senkt ihn.',
    },
  ];
}

export const lexicon: EntryLexicon = {
  keywords: ['ausspähen', 'Gegner'],
  seeAlso: ['probe', 'mission-spy', 'phalanx'],
  texts: [
    {
      text: 'Jede [[mission-spy]] hat einen Auspex-Wert. Jeder [[probe]] zählt einen Punkt. Dein Vorsprung in der Auspex-Lehre zählt im Quadrat – eine Stufe voraus bringt {one} Punkt, zwei bringen {two}, drei schon {three}. Liegst du zurück, kostet dich das genauso viel. Forschen lohnt sich also schnell mehr als Nachbauen.',
      values: {
        one: number(spyScore(0, 1)),
        two: number(spyScore(0, 2)),
        three: number(spyScore(0, 3)),
      },
    },
  ],
  formulas: [
    {
      text: 'Auspex-Wert = Spähschädel + Vorsprung² (bei Rückstand: − Rückstand²)',
      fn: (probes, lead) => probes! + Math.sign(lead!) * lead! ** 2,
      rule: spyScore,
      samples: [
        [1, 0],
        [12, 2],
        [5, -3],
        [0, 1],
      ],
    },
    {
      text: 'Höchste Chance auf Auspex-Abwehr in % = Spähschädel ÷ {probes} · Auspex-Lehre des Ziels ÷ deine Auspex-Lehre · (1 + Schiffe am Ziel ÷ {ships}) (höchstens {max})',
      values: {
        probes: number(PROBE_DIVISOR),
        ships: number(SHIP_DIVISOR),
        max: number(MAX_CHANCE),
      },
      fn: (probes, ships, target, spy) =>
        Math.min(100, (probes! / 4) * (target! / spy!) * (1 + ships! / 100)),
      rule: (probes, ships, target, spy) =>
        counterMax({
          probes: probes!,
          ships: ships!,
          target: target!,
          spy: spy!,
        }),
      samples: [
        [4, 0, 1, 1],
        [12, 100, 2, 3],
        [10, 1000, 1, 1],
        [40, 10, 5, 1],
        [1, 10, 1, 4],
      ],
    },
  ],
  blocks,
};
