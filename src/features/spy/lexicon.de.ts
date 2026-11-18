// What the article of the Auspex-Lehre adds in the Lexicanum (#285): the
// Auspex-Wert of a report, what it shows, how many Spähschädel it takes and
// the danger of losing them, computed from src/core/spy.ts. The texts are
// those of the design study of #285 (#287, [V]); every number comes from
// the rules.
import { number, percent } from '../../core/lexicon/parts.ts';
import type {
  Block,
  EntryLexicon,
  LexState,
} from '../../core/lexicon/types.ts';
import {
  counterChance,
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
const DANGER_LEADS = [-2, -1, 0, 1, 2];
const FLEETS = [10, 100, 1000, 10000];

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
    {
      t: 'table',
      caption: 'Gefahr, dass deine Spähschädel abgeschossen werden',
      head: ['Vorsprung in Auspex-Lehre', ...DANGER_LEADS.map(signed)],
      rows: FLEETS.map((ships) => ({
        cells: [
          `${number(ships)} Schiffe am Ziel`,
          ...DANGER_LEADS.map((lead) => `${counterChance(ships, lead)} %`),
        ],
      })),
    },
    {
      t: 'text',
      text: 'Je größer die Flotte am Ziel, desto eher werden die Spähschädel abgeschossen – aber nur mit der Wurzel: Die hundertfache Flotte ist zehnmal so gefährlich. Jede Stufe Vorsprung halbiert die Gefahr, jede Stufe Rückstand verdoppelt sie.',
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
      text: 'Gefahr = {base} · √Schiffe am Ziel ÷ 2^Vorsprung (höchstens {max})',
      values: { base: percent(0.02), max: percent(1) },
      fn: (ships, lead) =>
        ships
          ? Math.min(100, Math.round((2 * Math.sqrt(ships)) / 2 ** lead!))
          : 0,
      rule: counterChance,
      samples: [
        [0, 0],
        [10, -2],
        [100, 0],
        [1000, 1],
        [10000, 3],
      ],
    },
  ],
  blocks,
};
