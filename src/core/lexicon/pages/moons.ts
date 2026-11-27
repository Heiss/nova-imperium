// The rule page „Monde“ (#288): the moon chance after a battle, the diameter
// of a new moon, its fields, the Auspex-Phalanx and the Mondbruch. The
// numbers come from `src/core/moon.ts`, `fields.ts`, `phalanx.ts` and
// `moonbreak.ts`; the words are a draft of Claude for the owner to check
// ([V], #288).
import { BUILD, buildable } from '../../catalog.ts';
import { MOON_FIELDS, maxFields } from '../../fields.ts';
import { DIAMETER_CHANCE, moonChance, moonDiameter } from '../../moon.ts';
import { breakChance, lossChance } from '../../moonbreak.ts';
import { phalanxRange, SCAN_COST } from '../../phalanx.ts';
import {
  formulas,
  nameOf,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** The buildings that may stand on a moon, as the catalog lists them. */
const moonBuildings = (): string =>
  Object.keys(BUILD)
    .filter((key) => buildable(key, 'moon'))
    .map(nameOf)
    .join(', ');

const FIELDS = [50000, 100000, 500000, 1000000, 2000000, 5000000];
const CHANCES = [1, 5, 10, DIAMETER_CHANCE];
const LEVELS = [1, 2, 3, 5, 8, 10];
const DIAMETERS = [3000, 5000, 8000];
const BREAKERS = [1, 4, 16];

/** The smallest and the largest diameter a moon of this chance can get. */
const sizes = (chance: number): [number, number] => [
  moonDiameter(chance, () => 0),
  moonDiameter(chance, () => 0.999),
];

const moonFields = (level: number): number =>
  maxFields(
    { b: { moonbase: level }, diameter: 0, unlimited: false, kind: 'moon' },
    { extraFields: 0 },
  )!;

/** The diameter of a new moon: its formula and its sizes by the chance. */
const diameterBlocks = () => [
  say(
    'Der Durchmesser des neuen Mondes wird ausgelost und fällt im Mittel größer aus, wenn die Chance hoch war. Die Tabelle zeigt die kleinsten und größten Monde, die bei einer Chance möglich sind.',
  ),
  formulas({
    text: 'Durchmesser in km = ⌊√(x + 3 · Chance) · 1.000⌋, mit x ausgelost von 10 bis 20 und der Chance höchstens 20',
    fn: (chance, x) =>
      Math.floor(Math.sqrt(x! + 3 * Math.min(chance!, 20)) * 1000),
    rule: (chance, x) => moonDiameter(chance!, () => (x! - 9.5) / 11),
    samples: [
      [1, 10],
      [5, 15],
      [20, 20],
      [100, 20],
    ],
  }),
  table(
    'Durchmesser eines neuen Mondes',
    ['Mondchance', 'kleinster Mond in km', 'größter Mond in km'],
    CHANCES.map((chance) => [`${number(chance)} %`, ...sizes(chance)]),
  ),
];

// The cap and the resources per percent are those of the round (#433, 211).
const chanceSection = ({ round }: LexState): PageSection =>
  section(
    'chance',
    'Wie ein Mond entsteht',
    say(
      'Nach einem Kampf an einem Planeten ohne Mond wird gewürfelt, ob ein Mond entsteht. Die Chance ergibt sich aus dem Trümmerfeld, das nach dem Kampf an der Position liegt: je {per} Adamant und Psikristall darin ein Prozent, aber nie mehr als {max}. Gewürfelt wird einmal je Kampf, ein Planet hat höchstens einen Mond, und ein Kampf an einem Mond würfelt nichts. Mehr zum [[rule-debris|Trümmerfeld]] steht auf seiner Seite.',
      {
        per: number(round.moonPerPercent),
        max: `${number(round.moonChanceMax)} %`,
      },
    ),
    formulas({
      text: 'Mondchance in % = ⌊(Adamant + Psikristall im Trümmerfeld) ÷ {per}⌋, höchstens {max}',
      values: {
        per: number(round.moonPerPercent),
        max: number(round.moonChanceMax),
      },
      fn: (m, c) =>
        Math.min(
          Math.floor((m! + c!) / round.moonPerPercent),
          round.moonChanceMax,
        ),
      rule: (m, c) => moonChance({ m: m!, c: c! }, round),
      samples: [
        [0, 0],
        [60000, 40000],
        [150000, 250000],
        [3000000, 4000000],
      ],
    }),
    table(
      'Mondchance nach dem Trümmerfeld',
      ['Adamant und Psikristall im Feld', 'Mondchance'],
      FIELDS.map((total) => [
        total,
        `${number(moonChance({ m: total, c: 0 }, round))} %`,
      ]),
    ),
    ...diameterBlocks(),
  );

const fieldsSection = (): PageSection =>
  section(
    'fields',
    'Felder und Gebäude',
    say(
      'Ein Mond hat {start} Feld, gleich wie groß er ist, und die Zusatzfelder des Universums gelten für ihn nicht. Mehr Felder bringt die [[moonbase|Mondzitadelle]]: Jede Stufe schafft {gain} Felder, von denen sie selbst eines belegt. Auf einem Mond lassen sich nur diese Gebäude errichten: {buildings}.',
      {
        start: number(MOON_FIELDS),
        gain: number(BUILD.moonbase?.fields ?? 0),
        buildings: moonBuildings(),
      },
    ),
    formulas({
      text: 'Felder des Mondes = {start} + {gain} · Stufe der Mondzitadelle',
      values: {
        start: number(MOON_FIELDS),
        gain: number(BUILD.moonbase?.fields ?? 0),
      },
      fn: (level) => MOON_FIELDS + (BUILD.moonbase?.fields ?? 0) * level!,
      rule: moonFields,
      samples: [[0], [1], [5], [12]],
    }),
  );

const phalanxSection = (): PageSection =>
  section(
    'phalanx',
    'Auspex-Phalanx',
    say(
      'Die [[phalanx|Auspex-Phalanx]] steht nur auf einem Mond. Ihre Reichweite wächst im Quadrat der Stufe, gezählt in Systemen der eigenen Galaxie. Ein Scan kostet {cost} Promethium und zeigt alle Flüge von und zu einem fremden Planeten in Reichweite: Schiffe, Herkunft, Ziel und Ankunft, aber keine Ladung. Ein Mond lässt sich nicht scannen, und der gescannte Spieler erfährt nichts davon.',
      { cost: number(SCAN_COST.d) },
    ),
    formulas({
      text: 'Reichweite in Systemen = Stufe² − 1',
      fn: (level) => level! * level! - 1,
      rule: phalanxRange,
      samples: [[1], [2], [3], [5], [10]],
    }),
    table(
      'Reichweite der Auspex-Phalanx',
      ['Stufe', 'Reichweite in Systemen'],
      LEVELS.map((level) => [level, phalanxRange(level)]),
    ),
  );

const breakSection = (): PageSection =>
  section(
    'break',
    'Mondbruch',
    say(
      'Mit [[dstar|Weltenbrechern]] lässt sich der Mond eines anderen Spielers zerstören ([[mission-moonbreak]]). Nach einem gewonnenen Kampf, oder gegen einen Mond ohne Verteidigung, folgen zwei voneinander unabhängige Würfe: ob der Mond zerbricht und ob die Weltenbrecher vom eigenen Schuss zerrissen werden. Je größer der Mond, desto seltener zerbricht er und desto eher gehen die Weltenbrecher verloren; je mehr Weltenbrecher, desto eher zerbricht er. Ein zerbrochener Mond ist mit allem, was auf ihm war, verloren und hinterlässt kein Trümmerfeld. Flotten, die zu ihm unterwegs sind, landen auf seinem Planeten.',
    ),
    formulas(
      {
        text: 'Chance auf Mondbruch in % = (100 − √Durchmesser) · √Weltenbrecher, höchstens 100',
        fn: (d, n) => Math.min(100, (100 - Math.sqrt(d!)) * Math.sqrt(n!)),
        rule: breakChance,
        samples: [
          [3000, 1],
          [5000, 4],
          [8000, 16],
          [4000, 100],
        ],
      },
      {
        text: 'Chance auf Verlust der Weltenbrecher in % = √Durchmesser ÷ 2',
        fn: (d) => Math.sqrt(d!) / 2,
        rule: lossChance,
        samples: [[3000], [5000], [8000]],
      },
    ),
    table(
      'Chance auf Mondbruch in Prozent',
      ['Durchmesser in km', ...BREAKERS.map((n) => `${n} Weltenbrecher`)],
      DIAMETERS.map((d) => [
        d,
        ...BREAKERS.map((n) => percent(breakChance(d, n) / 100)),
      ]),
    ),
    table(
      'Chance auf Verlust der Weltenbrecher',
      ['Durchmesser in km', 'Verlust'],
      DIAMETERS.map((d) => [d, percent(lossChance(d) / 100)]),
    ),
  );

const page: PageDef = {
  id: 'rule-moons',
  kind: 'rule',
  title: 'Monde',
  line: 'Wie ein Mond entsteht, was auf ihm Platz hat und wie er zerbricht.',
  keywords: ['Mond', 'Trabant', 'Zitadelle', 'Phalanx', 'zerbrechen'],
  seeAlso: ['moonbase', 'phalanx', 'jumpgate', 'dstar', 'mission-moonbreak'],
  sections: (s) => [
    chanceSection(s),
    fieldsSection(),
    phalanxSection(),
    breakSection(),
  ],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 50, page };
