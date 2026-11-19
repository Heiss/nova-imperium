// The rule page „Flug und Treibstoff“ (#288): the distance, the flight time,
// the fuel, the drives and the fleet slots. The numbers come from
// `src/core/flight.ts`, the component `mobile` and the universe; the words
// are a draft of Claude for the owner to check ([V], #288).
import { MOBILE } from '../../catalog.ts';
import { DRIVE_BONUS, type DriveKey, speed } from '../../components/mobile.ts';
import {
  deployFuel,
  distance,
  fleetSlots,
  flightMs,
  fuelFor,
  holdFuel,
  shipSpeed,
} from '../../flight.ts';
import type { Coords, Universe } from '../../types.ts';
import {
  count,
  duration,
  formulas,
  nameOf,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { Cell, LexState, PageDef, PageSection } from '../types.ts';

const HOME: Coords = { g: 1, s: 1, p: 1 };

/** A target `d` galaxies, systems or positions away from home. */
const away = (axis: keyof Coords, d: number): Coords => ({
  ...HOME,
  [axis]: HOME[axis] + d,
});

/** The ships that fly, as the catalog lists them. */
const FLYING = Object.keys(MOBILE);

/** The ship the formulas of fuel are compared on. */
const SHIP = FLYING[0]!;

/** The drive researches, in the order of the table. */
const DRIVES = Object.keys(DRIVE_BONUS) as DriveKey[];

/** Pieces of a ship that every sample of a formula starts with. */
const fuelOf = (n: number, dist: number, pct: number): number =>
  fuelFor({ [SHIP]: n }, dist, pct);

/** The flight values of the ships that change their drive later: „ab Stufe …“. */
const switches = (): [string, string][] =>
  Object.entries(MOBILE).flatMap(([key, m]) =>
    (m.drives ?? []).map((d): [string, string] => [
      nameOf(key),
      `fliegt ab ${nameOf(d.from.research)} Stufe ${d.from.level} mit ${nameOf(d.drive)} und dem Grundtempo ${number(d.speed)}`,
    ]),
  );

/** One row of the table of flight times: a ship, its speed and three flights at full speed. */
const timeRow = (key: string, s: LexState): Cell[] => {
  const v = shipSpeed(key, { research: s.research });
  const at = (to: Coords): string =>
    duration(flightMs(distance(HOME, to), v, 10, s.u));
  return [
    { text: nameOf(key), link: key },
    v,
    at(away('p', 1)),
    at(away('s', 1)),
    at(away('g', 1)),
  ];
};

const distanceSection = (): PageSection =>
  section(
    'distance',
    'Entfernung',
    say(
      'Die Entfernung zählt in drei Stufen: Wechselst du die Galaxie, zählt nur der Unterschied der Galaxien. Bleibst du in der Galaxie und wechselst das System, zählt der Unterschied der Systeme, und bleibst du im System, zählt der Unterschied der Positionen. Jede Stufe hat einen Grundwert, damit auch das Nachbarsystem nie ganz nah ist. Gemessen wird nicht um das Ende einer Galaxie herum.',
    ),
    formulas(
      {
        text: 'Andere Galaxie: Entfernung = 20.000 · Unterschied der Galaxien',
        fn: (d) => 20000 * d!,
        rule: (d) => distance(HOME, away('g', d!)),
        samples: [[1], [2], [6]],
      },
      {
        text: 'Anderes System: Entfernung = 2.700 + 95 · Unterschied der Systeme',
        fn: (d) => 2700 + 95 * d!,
        rule: (d) => distance(HOME, away('s', d!)),
        samples: [[1], [10], [49]],
      },
      {
        text: 'Andere Position: Entfernung = 1.000 + 5 · Unterschied der Positionen',
        fn: (d) => 1000 + 5 * d!,
        rule: (d) => distance(HOME, away('p', d!)),
        samples: [[1], [5], [14]],
      },
      {
        text: 'Gleiche Position: Entfernung = 5',
        fn: () => 5,
        rule: () => distance(HOME, HOME),
        samples: [[0]],
      },
    ),
    table(
      'Entfernung zu Beispielzielen',
      ['Ziel', 'Entfernung'],
      [
        ['1 Position weiter', distance(HOME, away('p', 1))],
        ['10 Positionen weiter', distance(HOME, away('p', 10))],
        ['1 System weiter', distance(HOME, away('s', 1))],
        ['10 Systeme weiter', distance(HOME, away('s', 10))],
        ['1 Galaxie weiter', distance(HOME, away('g', 1))],
      ],
    ),
  );

const timeSection = (s: LexState): PageSection =>
  section(
    'time',
    'Flugzeit',
    say(
      'Die Flugzeit wächst langsamer als die Entfernung, denn sie folgt der Wurzel daraus. Ein höheres Tempo verkürzt sie ebenfalls nur mit der Wurzel: Für die halbe Flugzeit braucht ein Schiff etwa das Vierfache an Tempo. Beim Start wählst du in Zehnerschritten, mit wie viel Prozent ihres Tempos die Flotte fliegt, und die Flotte fliegt so schnell wie ihr langsamstes Schiff. In diesem Universum laufen alle Flüge {speed}-mal so schnell.',
      { speed: number(s.u.speed) },
    ),
    formulas({
      text: 'Flugzeit in Sekunden = (3.500 ÷ Tempoanteil · √(Entfernung · 10 ÷ Tempo) + 10) ÷ Tempo des Universums',
      fn: (dist, v, pct, universe) =>
        Math.round(
          (((3500 / (pct! / 10)) * Math.sqrt((dist! * 10) / v!) + 10) /
            universe!) *
            1000,
        ) / 1000,
      rule: (dist, v, pct, universe) =>
        flightMs(dist!, v!, pct!, { speed: universe! } as Universe) / 1000,
      samples: [
        [1005, 5000, 10, 1],
        [2795, 12500, 5, 5],
        [20000, 10000, 1, 40],
        [1000, 2500, 10, 3],
      ],
    }),
    say(
      'Der Tempoanteil ist die gewählte Geschwindigkeit zwischen einem Zehntel und dem Ganzen des Tempos. Die Tabelle zeigt die Flugzeit bei vollem Tempo mit deiner Forschung in diesem Universum.',
    ),
    table(
      'Tempo und Flugzeit der Schiffe bei vollem Tempo',
      [
        'Schiff',
        'Tempo',
        'Nachbarposition',
        'Nächstes System',
        'Nächste Galaxie',
      ],
      FLYING.map((key) => timeRow(key, s)),
    ),
  );

const fuelSection = (): PageSection =>
  section(
    'fuel',
    'Treibstoff',
    say(
      'Jedes Schiff verbraucht Promethium, und zwar mehr, je weiter das Ziel ist und je schneller die Flotte fliegt. Der Verbrauch wächst mit der Entfernung gleichmäßig und mit dem Tempoanteil im Quadrat; langsamer zu fliegen spart also Promethium und kostet Zeit. Zum Verbrauch aller Schiffe kommt immer ein Promethium dazu.',
    ),
    formulas({
      text: 'Promethium = Summe über alle Schiffe (Verbrauch · Anzahl · Entfernung ÷ 35.000 · (Tempoanteil + 1)²), gerundet, + 1',
      fn: (n, dist, pct) =>
        Math.round(
          ((MOBILE[SHIP]!.fuel * n! * dist!) / 35000) * (pct! / 10 + 1) ** 2,
        ) + 1,
      rule: fuelOf,
      samples: [
        [1, 1005, 10],
        [10, 2795, 5],
        [250, 20000, 1],
        [40, 1005, 8],
      ],
    }),
    say(
      'Wer [[mission-hold|Wache stellt]], zahlt den Treibstoff für die Haltezeit beim Start dazu, und zwar ein Zehntel des Grundverbrauchs je Schiff und Stunde, mindestens aber ein Promethium. Die [[mission-deploy|Verlegung]] schreibt dem Zielplaneten die Hälfte des verbrauchten Treibstoffs gut.',
    ),
    formulas(
      {
        text: 'Treibstoff der Haltezeit = Summe über alle Schiffe (Grundverbrauch · Anzahl · Stunden ÷ 10), abgerundet, mindestens 1',
        fn: (n, hours) =>
          Math.max(Math.floor((MOBILE[SHIP]!.fuel * n! * hours!) / 10), 1),
        rule: (n, hours) => holdFuel({ [SHIP]: n! }, hours!),
        samples: [
          [1, 1],
          [20, 8],
          [100, 32],
          [3, 0],
        ],
      },
      {
        text: 'Gutschrift der Verlegung = ⌊verbrauchter Treibstoff ÷ 2⌋',
        fn: (fuel) => Math.floor(fuel! / 2),
        rule: deployFuel,
        samples: [[1], [101], [4000]],
      },
    ),
  );

const drivesSection = (): PageSection =>
  section(
    'drives',
    'Antriebe',
    say(
      'Das Tempo eines Schiffs hängt vom Antrieb ab, mit dem es fliegt, und von deiner Forschung darin: Jede Stufe legt einen festen Anteil des Grundtempos obendrauf, bei jedem Antrieb einen anderen. Die Artikel der Antriebe nennen die Werte im Einzelnen.',
    ),
    table(
      'Zuwachs des Tempos je Stufe der Antriebsforschung',
      ['Forschung', 'Zuwachs je Stufe'],
      DRIVES.map((key) => [
        { text: nameOf(key), link: key },
        percent(DRIVE_BONUS[key]),
      ]),
    ),
    formulas({
      text: 'Tempo = Grundtempo · (1 + Zuwachs · Stufe des Antriebs)',
      fn: (base, drive, level) =>
        base! * (1 + DRIVE_BONUS[DRIVES[drive!]!] * level!),
      rule: (base, drive, level) =>
        speed(
          { cargo: 0, speed: base!, fuel: 1, drive: DRIVES[drive!]! },
          { [DRIVES[drive!]!]: level! },
        ),
      samples: [
        [5000, 0, 3],
        [12500, 1, 6],
        [10000, 2, 15],
      ],
    }),
    ...(switches().length
      ? [
          say(
            'Einige Schiffe wechseln den Antrieb, sobald du die dazugehörige Forschung erreicht hast; ab dann zählen ihr neues Grundtempo und der Zuwachs des neuen Antriebs.',
          ),
          {
            t: 'facts' as const,
            items: switches().map(([label, text]) => ({ label, text })),
          },
        ]
      : []),
  );

const slotsSection = (s: LexState): PageSection =>
  section(
    'slots',
    'Flottenslots',
    say(
      'Wie viele Flotten gleichzeitig unterwegs sein dürfen, bestimmt die [[computer|Kogitator-Doktrin]]: Ohne sie ein Flottenslot, und jede Stufe bringt einen dazu, über alle deine Planeten zusammen. Raketen aus der Raketenkrypta brauchen keinen Slot.',
    ),
    formulas({
      text: 'Flottenslots = 1 + Stufe der Kogitator-Doktrin',
      fn: (level) => 1 + level!,
      rule: (level) => fleetSlots({ research: { computer: level! } }),
      samples: [[0], [1], [5], [12]],
    }),
    {
      t: 'stand',
      text: `Dein Stand: Stufe ${s.research.computer ?? 0} der Kogitator-Doktrin, ${count(fleetSlots({ research: s.research }), 'Flottenslot', 'Flottenslots')}.`,
    },
  );

export const page: PageDef = {
  id: 'rule-flight',
  kind: 'rule',
  title: 'Flug und Treibstoff',
  line: 'Wie weit ein Ziel ist, wie lange der Flug dauert, was er an Promethium kostet und wie viele Flotten du schicken darfst.',
  keywords: ['fliegen', 'Entfernung', 'Flugzeit', 'Verbrauch', 'Tempo'],
  seeAlso: ['computer', 'comb', 'impulse', 'hdrive', 'rule-universe'],
  sections: (s) => [
    distanceSection(),
    timeSection(s),
    fuelSection(),
    drivesSection(),
    slotsSection(s),
  ],
};
