// The rule page „Expeditionen“ (#288, #93): the expedition position, the
// places and the stay, what can happen after the stay with its shares, the
// finds, the raids, the changes of the return time and the settings of the
// round. The numbers come from `src/core/expedition.ts`,
// `expedition-ships.ts` and the round; the words are a draft of Claude for
// the owner to check ([V], #288).
import { SHIPS } from '../../catalog.ts';
import {
  DIVISOR,
  drawResource,
  earlyReturn,
  EVENT_CHANCE,
  EVENT_KINDS,
  EVENT_SHARES,
  type EventKind,
  EXTRA_SLOTS,
  expeditionLevel,
  expeditionPosition,
  expeditionSlots,
  extraSlots,
  HOURS_PER_LEVEL,
  hoursPerLevel,
  HUGE_FROM,
  LARGE_FROM,
  lateReturn,
  maxStayHours,
  MIN_FLIGHT_MS,
  MIN_RESOURCE_POINTS,
  RAIDER_TECH_STEP,
  type Raider,
  RAIDS,
  raiderTech,
  raidFleet,
  resourceBase,
  resourceFind,
  roundSettings,
  type Size,
  SPREAD,
  staysByUniverseSpeed,
  stayDuration,
  TIME_FACTOR,
  capsOf,
} from '../../expedition.ts';
import {
  expoPoints,
  findable,
  MIN_SHIP_FIND,
  shipBase,
} from '../../expedition-ships.ts';
import {
  duration,
  facts,
  formulas,
  nameOf,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

const LEVELS = [1, 2, 4, 5, 9, 10, 16, 25];
const RANK_ONE = [50_000, 500_000, 3_000_000, 10_000_000];
const SIZES: readonly Size[] = ['normal', 'large', 'huge'];
const SIZE_NAMES: Readonly<Record<Size, string>> = {
  normal: 'normal',
  large: 'groß',
  huge: 'sehr groß',
};
const EVENT_NAMES: Readonly<Record<EventKind, string>> = {
  resources: 'Rohstofffund',
  ships: 'Schiffsfund',
  pirates: 'Kampf gegen Piraten',
  aliens: 'Kampf gegen Aliens',
  lost: 'Verlust der Flotte',
  early: 'Frühere Rückkehr',
  late: 'Spätere Rückkehr',
};
const RAIDERS: readonly Raider[] = ['pirates', 'aliens'];
const RAIDER_NAMES: Readonly<Record<Raider, string>> = {
  pirates: 'Piraten',
  aliens: 'Aliens',
};
const RESOURCE_NAMES = { m: 'Adamant', c: 'Psikristall', d: 'Promethium' };

/** A generator that gives the numbers in turn: for the rules that draw. */
const draws =
  (...values: number[]) =>
  () => {
    const next = values.shift();
    return next ?? 0;
  };

/** The share a resource has of the finds, counted over an even grid of draws. */
const resourceShare = (res: 'm' | 'c' | 'd'): number => {
  const grid = 6000;
  let n = 0;
  for (let i = 0; i < grid; i++)
    if (drawResource(() => (i + 0.5) / grid) === res) n++;
  return n / grid;
};

const placeFormulas = (): Block =>
  formulas(
    {
      text: 'Expeditionsplätze = ⌊√Stufe der {research}⌋ + zusätzliche Plätze der Runde',
      values: { research: nameOf('expo') },
      fn: (l, x) => Math.floor(Math.sqrt(l!)) + x!,
      rule: expeditionSlots,
      samples: [
        [1, 0],
        [4, 0],
        [10, 2],
        [25, 10],
      ],
    },
    {
      text: 'Höchste Haltezeit in Stunden = Stufe · Stunden je Stufe der Runde',
      fn: (l, h) => l! * h!,
      rule: maxStayHours,
      samples: [
        [1, 1],
        [5, 1],
        [9, 3],
        [25, 24],
      ],
    },
  );

const placeSection = (s: LexState): PageSection => {
  const extra = extraSlots(s.u);
  const per = hoursPerLevel(s.u);
  const level = expeditionLevel(s.research);
  return section(
    'place',
    'Ziel, Plätze und Haltezeit',
    say(
      'Eine Expedition fliegt zur Expeditionsposition am Rand jedes Systems, der Position {position} in diesem Universum, gleich hinter der letzten Planetenposition. Dort lässt sich nichts besiedeln. Der Auftrag braucht die [[expo|Kreuzzugs-Kartografie]], mindestens die erste Stufe, und belegt einen Flottenslot und einen Expeditionsplatz. Die Plätze zählen auch die Expeditionen, die schon auf dem Heimweg sind. Die Haltezeit wählst du beim Start in ganzen Stunden bis zum Höchstwert; erst wenn sie um ist, wird das Ergebnis der Expedition ausgelost, und die Flotte fliegt heim. Die Haltezeit kostet keinen Treibstoff.',
      { position: number(expeditionPosition(s.u)) },
    ),
    placeFormulas(),
    table(
      'Plätze und Haltezeit nach der Stufe in dieser Runde',
      [
        'Stufe',
        'Expeditionsplätze',
        'Höchste Haltezeit',
        'Dauer in diesem Universum',
      ],
      LEVELS.map((l) => [
        l,
        expeditionSlots(l, extra),
        `${number(maxStayHours(l, per))} Std.`,
        duration(stayDuration(maxStayHours(l, per), s.u)),
      ]),
      (i) => LEVELS[i] === level,
    ),
    {
      t: 'stand',
      text: `Dein Stand: Stufe ${number(level)} der ${nameOf('expo')}, ${number(expeditionSlots(level, extra))} Expeditionsplätze, höchste Haltezeit ${number(maxStayHours(level, per))} Std.`,
    },
  );
};

/** The share of a size among the events: how the draw splits at its limits. */
const sizeShare = (size: Size): number =>
  size === 'normal'
    ? LARGE_FROM
    : size === 'large'
      ? HUGE_FROM - LARGE_FROM
      : 1 - HUGE_FROM;

const eventSection = (): PageSection =>
  section(
    'events',
    'Was geschehen kann',
    say(
      'Nach der Haltezeit wird einmal ausgelost: In etwa {chance} der Expeditionen bringen ein Ereignis, die anderen kehren ohne etwas heim. Welches Ereignis es ist, folgt den Anteilen der Tabelle; außer dem Verlust der Flotte hat jedes eine Größe. Das Ergebnis steht im Bericht, und was von der Flotte übrig ist, fliegt heim.',
      { chance: percent(EVENT_CHANCE) },
    ),
    table(
      'Anteil der Ereignisse',
      ['Ereignis', 'Anteil an allen Expeditionen', 'Anteil an den Ereignissen'],
      [
        ['Nichts', percent(1 - EVENT_CHANCE), '–'],
        ...EVENT_KINDS.map((k) => [
          EVENT_NAMES[k],
          percent(EVENT_SHARES[k] * EVENT_CHANCE),
          percent(EVENT_SHARES[k]),
        ]),
      ],
    ),
    table(
      'Anteil der Größen unter den Ereignissen mit Größe',
      ['Größe', 'Anteil'],
      SIZES.map((size) => [SIZE_NAMES[size], percent(sizeShare(size))]),
    ),
  );

/** The base number of a find: its lowest and highest value. */
const baseSpan = (base: (r: () => number, size: Size) => number, size: Size) =>
  `${number(base(() => 0, size))} bis ${number(base(() => 0.999999, size))}`;

const resourceFormula = (): Block =>
  formulas({
    text: 'Fund = ⌊Grundzahl ÷ Teiler der Sorte · Faktor⌋, höchstens der freie Laderaum; Faktor = Expeditionspunkte, mindestens {least} und höchstens die Obergrenze',
    values: { least: number(MIN_RESOURCE_POINTS) },
    fn: (top, res, points, rank, room) =>
      Math.max(
        0,
        Math.min(
          Math.floor(
            (resourceBase(() => (top! ? 0.999999 : 0), 'large') /
              DIVISOR[(['m', 'c', 'd'] as const)[res!]!]) *
              Math.min(
                capsOf(rank!).resources,
                Math.max(MIN_RESOURCE_POINTS, points!),
              ),
          ),
          Math.floor(room!),
        ),
      ),
    rule: (top, res, points, rank, room) =>
      resourceFind(
        draws(top! ? 0.999999 : 0, [0.1, 0.6, 0.95][res!]!),
        'large',
        points!,
        rank!,
        room!,
      ).amount,
    samples: [
      [0, 0, 50, 50_000, 1e9],
      [1, 1, 3000, 500_000, 1e9],
      [1, 2, 100, 7_000_000, 1e9],
      [0, 0, 8000, 20_000, 1000],
    ],
  });

const resourceSection = (): PageSection =>
  section(
    'resources',
    'Rohstofffund',
    say(
      'Ein Rohstofffund beginnt mit einer Grundzahl, die mit der Größe des Ereignisses wächst. Dann wird die Sorte ausgelost. Die Grundzahl wird durch den Teiler der Sorte geteilt und mit einem Faktor malgenommen, der aus den Expeditionspunkten deiner Flotte folgt: Sie zählen aus den Kosten ihrer Schiffe in Adamant und Psikristall, mindestens so viel wie angegeben und höchstens bis zur Obergrenze, die mit den Punkten des Ersten der Rangliste steigt. Mitgenommen wird nur, was die Laderäume fassen; die Hälfte des verbrauchten Treibstoffs belegt dort schon Platz.',
    ),
    resourceFormula(),
    formulas({
      text: 'Expeditionspunkte = Summe über alle Schiffe (Anzahl · (Adamant + Psikristall des Schiffs)) · 5 ÷ 1.000',
      fn: (n, i) => {
        const unit = SHIPS[Object.keys(SHIPS)[i!]!]!;
        return (n! * (unit.cost[0] + unit.cost[1]) * 5) / 1000;
      },
      rule: (n, i) => expoPoints({ [Object.keys(SHIPS)[i!]!]: n! }),
      samples: [
        [1, 0],
        [10, 3],
        [250, 6],
      ],
    }),
    table(
      'Grundzahl, Teiler und Anteil je Sorte',
      ['Sorte', 'Teiler', 'Anteil an den Funden'],
      (['m', 'c', 'd'] as const).map((res) => [
        RESOURCE_NAMES[res],
        DIVISOR[res],
        percent(resourceShare(res)),
      ]),
    ),
    table(
      'Grundzahl eines Rohstofffunds nach Größe',
      ['Größe', 'Grundzahl'],
      SIZES.map((size) => [SIZE_NAMES[size], baseSpan(resourceBase, size)]),
    ),
    table(
      'Obergrenze der Punkte nach den Punkten des Ersten der Rangliste',
      ['Punkte des Ersten', 'Rohstofffund', 'Schiffsfund'],
      RANK_ONE.map((rank) => [
        rank,
        capsOf(rank).resources,
        capsOf(rank).ships,
      ]),
    ),
  );

/** The names of the ships a fleet whose heaviest ship is `key` can find. */
const findableNames = (key: string): string => {
  const found = findable({ [key]: 1 });
  return found.length ? found.map(nameOf).join(', ') : 'keine';
};

const shipSection = (): PageSection =>
  section(
    'ships',
    'Schiffsfund',
    say(
      'Bei einem Schiffsfund haben die gefundenen Schiffe zusammen so viele Strukturpunkte, wie die Grundzahl der Größe mal die Expeditionspunkte der Flotte ergibt, mindestens aber {least}. Dann wird immer wieder ein Schiff ausgelost, alle gleich wahrscheinlich, und davon eine Anzahl gefunden, bis die Punkte aufgebraucht sind oder das ausgeloste Schiff nicht mehr hineinpasst; dort endet der Fund. Gefunden werden kann, was bis zu einem Schritt schwerer ist als das schwerste Schiff der Flotte. Die Schiffe schließen sich der Flotte an. Die Kolonistenarche, die Bergungsbarke und der Weltenbrecher finden nichts und werden nie gefunden; eine Flotte nur aus ihnen findet keine Schiffe.',
      { least: number(MIN_SHIP_FIND) },
    ),
    table(
      'Grundzahl eines Schiffsfunds nach Größe',
      ['Größe', 'Grundzahl'],
      SIZES.map((size) => [SIZE_NAMES[size], baseSpan(shipBase, size)]),
    ),
    table(
      'Was eine Flotte finden kann, nach ihrem schwersten Schiff',
      ['Schwerstes Schiff der Flotte', 'Findbare Schiffe'],
      Object.keys(SHIPS).map((key) => [
        { text: nameOf(key), link: key },
        findableNames(key),
      ]),
    ),
  );

const raidFormula = (): Block =>
  formulas({
    text: 'Angreifer einer Art = Schiffe der Art in deiner Flotte · Anteil · (1 − {spread} + 2 · {spread} · Zufall von 0 bis 1), bei Piraten abgerundet, bei Aliens aufgerundet; dazu die zusätzlichen Schiffe',
    values: { spread: number(SPREAD) },
    fn: (n, raider, size, z) => {
      const share = RAIDS[RAIDERS[raider!]!][SIZES[size!]!].share;
      const round = raider === 0 ? Math.floor : Math.ceil;
      return round(n! * share * (1 - SPREAD + 2 * SPREAD * z!));
    },
    rule: (n, raider, size, z) =>
      raidFleet(() => z!, RAIDERS[raider!]!, SIZES[size!]!, {
        probe: n!,
      }).probe ?? 0,
    samples: [
      [10, 0, 0, 0.5],
      [37, 0, 1, 0.9],
      [37, 1, 1, 0.1],
      [200, 1, 2, 0.99],
    ],
  });

const raidTechFormula = (): Block =>
  formulas(
    {
      text: 'Stufe der Piraten = Stufe deiner Forschung − {step}, mindestens 0',
      values: { step: number(RAIDER_TECH_STEP) },
      fn: (level) => Math.max(0, level! - RAIDER_TECH_STEP),
      rule: (level) => raiderTech('pirates', { weapons: level! }).weapons!,
      samples: [[0], [2], [3], [9]],
    },
    {
      text: 'Stufe der Aliens = Stufe deiner Forschung + {step}',
      values: { step: number(RAIDER_TECH_STEP) },
      fn: (level) => level! + RAIDER_TECH_STEP,
      rule: (level) => raiderTech('aliens', { weapons: level! }).weapons!,
      samples: [[0], [2], [9]],
    },
  );

const raidSection = (): PageSection =>
  section(
    'raids',
    'Piraten und Aliens',
    say(
      'Bei einem Kampf gegen Piraten oder Aliens greifen sie an, und deine Flotte verteidigt sich. Von jeder Schiffsart deiner Flotte kommt ein Anteil als Angreifer, der um ein Zehntel nach oben oder unten streut, dazu einige Schiffe einer festen Art. Waffen, Schilde und Panzerung der Angreifer richten sich nach deiner Forschung. Gekämpft wird nach den Regeln des Kampfes ([[rule-battle]]). Die zerstörten Schiffe beider Seiten hinterlassen ein Trümmerfeld an der Expeditionsposition, das eine Bergung einsammeln kann ([[rule-debris]]). Was von deiner Flotte übrig ist, fliegt heim; ist nichts mehr übrig, ist die Flotte verloren. Der Bericht ist ein Kampfbericht.',
    ),
    raidFormula(),
    raidTechFormula(),
    table(
      'Die Angreifer nach Größe',
      ['Angreifer', 'Größe', 'Anteil je Schiffsart', 'Zusätzliche Schiffe'],
      RAIDERS.flatMap((raider) =>
        SIZES.map((size) => {
          const spec = RAIDS[raider][size];
          return [
            RAIDER_NAMES[raider],
            SIZE_NAMES[size],
            percent(spec.share),
            `${number(spec.extra)} × ${nameOf(spec.ship)}`,
          ];
        }),
      ),
    ),
  );

const returnSection = (): PageSection =>
  section(
    'return',
    'Frühere und spätere Rückkehr, Verlust',
    say(
      'Eine Expedition kann sich verirren oder eine Abkürzung finden, und die Zeit des Heimflugs ändert sich dann wirklich. Bei einer späteren Rückkehr dauert der Heimflug um die Haltezeit mal den Faktor der Größe länger. Bei einer früheren wird er um ein Drittel der Haltezeit mal den Faktor kürzer, mindestens {least} lang bleibt er aber. Beim Verlust der Flotte kommt nichts zurück, und es bleibt kein Trümmerfeld.',
      { least: duration(MIN_FLIGHT_MS) },
    ),
    formulas(
      {
        text: 'Spätere Rückkehr: Heimflug = Flugzeit + Haltezeit · Faktor',
        fn: (flight, stay, size) =>
          flight! + stay! * TIME_FACTOR[SIZES[size!]!],
        rule: (flight, stay, size) =>
          lateReturn(0, flight!, stay!, SIZES[size!]!),
        samples: [
          [100000, 3_600_000, 0],
          [250000, 7_200_000, 2],
        ],
      },
      {
        text: 'Frühere Rückkehr: Heimflug = Flugzeit − Haltezeit ÷ 3 · Faktor, mindestens {least}',
        values: { least: duration(MIN_FLIGHT_MS) },
        fn: (flight, stay, size) =>
          Math.max(
            MIN_FLIGHT_MS,
            Math.round(flight! - (stay! / 3) * TIME_FACTOR[SIZES[size!]!]),
          ),
        rule: (flight, stay, size) =>
          earlyReturn(0, flight!, stay!, SIZES[size!]!),
        samples: [
          [100000, 3_600_000, 0],
          [4_000_000, 3_600_000, 1],
          [250000, 7_200_000, 2],
        ],
      },
    ),
    table(
      'Der Faktor nach Größe',
      ['Größe', 'Faktor'],
      SIZES.map((size) => [SIZE_NAMES[size], TIME_FACTOR[size]]),
    ),
  );

const settingsSection = (s: LexState): PageSection =>
  section(
    'settings',
    'Einstellungen dieser Runde',
    say(
      'Der Admin legt drei Dinge für die Runde fest und kann sie während der Runde ändern. Die Liste nennt ihre Werte jetzt und die Grenzen, in denen sie liegen dürfen.',
    ),
    facts([
      [
        roundSettings[0].label,
        `${number(extraSlots(s.u))} (von ${number(EXTRA_SLOTS.min)} bis ${number(EXTRA_SLOTS.max)})`,
      ],
      [
        roundSettings[1].label,
        `${number(hoursPerLevel(s.u))} (von ${number(HOURS_PER_LEVEL.min)} bis ${number(HOURS_PER_LEVEL.max)})`,
      ],
      [roundSettings[2].label, staysByUniverseSpeed(s.u) ? 'ja' : 'nein'],
    ]),
  );

const page: PageDef = {
  id: 'rule-expeditions',
  kind: 'rule',
  title: 'Expeditionen',
  line: 'Wohin eine Expedition fliegt, wie lange sie bleibt und was sie finden, erleben oder verlieren kann.',
  keywords: ['Expedition', 'erkunden', 'Fund', 'Piraten', 'Haltezeit'],
  seeAlso: [
    'mission-expedition',
    'expo',
    'rule-battle',
    'rule-debris',
    'rule-flight',
  ],
  sections: (s) => [
    placeSection(s),
    eventSection(),
    resourceSection(),
    shipSection(),
    raidSection(),
    returnSection(),
    settingsSection(s),
  ],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 110, page };
