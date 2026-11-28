// The rule page „Wache stellen und Verbandsangriff“ (#288, #55, #225): who
// may hold at a planet, the holding times, the fuel and the limits, what a
// guard does in the fights, vacation and Mondbruch, and the attack union:
// opening, inviting, joining at the fixed arrival with the speed that
// brings a fleet there (#466), the limits, the split of the loot and the
// recall. The numbers come from `src/core/holding.ts`, `union.ts`,
// `flight.ts` and the round; the words are a draft of Claude for the owner to
// check ([V], #288).
import { MOBILE } from '../../catalog.ts';
import { holdFuel } from '../../flight.ts';
import { HOLD_LEXICON } from '../../hold-texts.ts';
import {
  HELD_SPY,
  HOLD_HOURS,
  HOLD_LIMITS,
  roundSettings as holdSettings,
} from '../../holding.ts';
import {
  FASTEST,
  roundSettings as unionSettings,
  SLOWEST,
  splitLoot,
  UNION_RANGES,
  unionFlight,
} from '../../union.ts';
import type { Universe } from '../../types.ts';
import { facts, formulas, minutes, number, say, section } from '../say.ts';
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

/** The number settings of the union in the order of the registry; the switch is the last. */
const UNION_KEYS = ['fleets', 'players', 'cutoff'] as const;

/** The value of a live setting of the round, from the universe. */
const value = (u: Universe, key: string): number =>
  (u as unknown as Record<string, number>)[key] ?? 0;

/** The words of the setting „Verbündete für Halten und Verband“ for its value. */
const alliesWords = (u: Universe): string => {
  const [allies] = holdSettings;
  const v = value(u, allies.key);
  return allies.choices.find((c) => c.value === v)?.label ?? number(v);
};

/** The holding times as a list of words: „0, 1, 2 und 4“. */
const holdingTimes = (): string =>
  `${HOLD_HOURS.slice(0, -1).map(number).join(', ')} oder ${number(HOLD_HOURS[HOLD_HOURS.length - 1]!)}`;

const fuelFormula = (): Block =>
  formulas({
    text: 'Treibstoff der Haltezeit = ⌊Summe aller Schiffe (Anzahl · Grundverbrauch) · Stunden ÷ 10⌋, mindestens 1',
    fn: (small, large, hours) =>
      Math.max(
        Math.floor(
          ((small! * MOBILE.sc!.fuel + large! * MOBILE.cr!.fuel) * hours!) / 10,
        ),
        1,
      ),
    rule: (small, large, hours) => holdFuel({ sc: small!, cr: large! }, hours!),
    samples: [
      [10, 0, 1],
      [4, 3, 8],
      [100, 20, 32],
      [1, 0, 0],
    ],
  });

const guardWho = (s: LexState): PageSection =>
  section(
    'guard',
    'Wache stellen: wer, wo und wie lange',
    say(
      'Mit [[mission-hold|Wache stellen]] fliegt eine Flotte zum Planeten oder Mond eines Verbündeten, bleibt dort die Haltezeit, die du beim Start wählst, und verteidigt ihn in jedem Kampf zusammen mit seinem Besitzer; danach fliegt sie heim. Wer Verbündeter ist, legt der Admin für die Runde fest. Eine Gilde zählt nur, solange es in der Runde Gilden gibt ([[rule-guilds]]). Bei einem Spieler im [[rule-vacation|Urlaubsmodus]] kann niemand Wache stellen.',
    ),
    facts([
      [holdSettings[0].label, alliesWords(s.u)],
      [
        holdSettings[1].label,
        `${number(value(s.u, holdSettings[1].key))} (von ${number(HELD_SPY.min)} bis ${number(HELD_SPY.max)})`,
      ],
    ]),
    say(
      'Die Haltezeit beträgt {times} Stunden. Sie läuft in Echtzeit, das Tempo des Universums teilt sie nicht. Den Treibstoff für die Haltezeit zahlst du beim Start zusammen mit dem für den Flug: ein Zehntel des Grundverbrauchs der Flotte je Stunde, mindestens {least} Promethium. An einem Planeten halten höchstens {players} verschiedene Spieler mit zusammen höchstens {fleets} Flotten, die eigene Flotte des Besitzers nicht mitgerechnet; gezählt werden auch Flotten, die noch unterwegs sind. Solange eine Flotte Wache hält, kannst du sie zurückrufen; sie ist dann nach so langer Zeit zu Hause, wie ihr Hinflug gedauert hat.',
      {
        times: holdingTimes(),
        least: number(holdFuel({}, 0)),
        players: number(HOLD_LIMITS.players),
        fleets: number(HOLD_LIMITS.fleets),
      },
    ),
    fuelFormula(),
  );

const guardFights = (): PageSection =>
  section(
    'fights',
    'Was eine Wache tut',
    say(
      'Eine Flotte, die Wache hält, kämpft als eigene Partei mit der Forschung ihres Besitzers, und zwar in allen drei Kämpfen an diesem Ort: beim [[mission-attack|Sturmangriff]], beim [[mission-moonbreak|Mondbruch]] und im Kampf gegen entdeckte Spähschädel der [[mission-spy|Auspex-Erkundung]]. Raketen kämpfen nicht mit. Jeder Besitzer bekommt den Bericht des Verteidigers, und was die Wache verliert, liegt zum Teil im Trümmerfeld ([[rule-debris]]). Eine Flotte des Angreifers selbst, die dort Wache hält, bleibt aus dem Kampf.',
    ),
    // The held cargo is no loot since #440 (233b): the words are the owner's.
    say(HOLD_LEXICON.noLoot),
    say(
      'Der Gastgeber sieht eine Flotte, die Wache hält, mit allen Schiffen und ihrer Haltezeit. Im Auspex-Bericht zählt sie zur Flotte des Planeten, bis die Auspex-Lehre des Spähers die Stufe der Runde erreicht; ab dann steht sie getrennt unter Gehaltene Flotten. In der Auspex-Phalanx zeigt sie sich als haltend, mit dem Ende ihrer Haltezeit.',
    ),
  );

const guardLeaves = (): PageSection =>
  section(
    'leaves',
    'Urlaubsmodus und Mondbruch',
    say(
      'Beginnt der Gastgeber den Urlaubsmodus, fliegen alle Flotten, die bei ihm Wache halten, sofort heim, und ihre Besitzer bekommen einen Bericht. Eine Flotte, die noch unterwegs ist, hält bei der Ankunft nicht mehr, sondern kehrt gleich um. Wer selbst mit einer Flotte Wache hält, kann den Urlaubsmodus nicht beginnen, solange sie draußen ist ([[rule-vacation]]).',
    ),
    say(
      'Zerbricht ein Mond ([[rule-moons]]), wechseln die Flotten, die dort Wache halten und am Kampf nicht beteiligt waren, zum Planeten des Mondes und halten dort bis zum Ende ihrer Zeit weiter; die Grenzen des Planeten werden dabei nicht geprüft, und ihre Besitzer bekommen einen Bericht. Da ein Mond nur nach einem gewonnenen Kampf zerbricht und dieser keinen Verteidiger übrig lässt, betrifft das nur die eigene Flotte des Angreifers.',
    ),
  );

const speedFormula = (): Block =>
  formulas({
    text: 'Geschwindigkeit einer beitretenden Flotte in Zehnteln = 35.000 · √(10 · Entfernung ÷ Schiffsgeschwindigkeit) ÷ (Restflugzeit in Sekunden · Universums-Tempo − 10), zwischen 1 (10 %) und 10 (100 %); hier mit dem Universums-Tempo 1',
    fn: (dist, speed, left) =>
      (35000 * Math.sqrt((10 * dist!) / speed!)) / (left! - 10),
    rule: (dist, speed, left) => {
      const out = unionFlight({
        dist: dist!,
        speed: speed!,
        universe: { speed: 1 } as Universe,
        now: 0,
        arr: left! * 1000,
      });
      return 'pct' in out ? out.pct : Number.NaN;
    },
    samples: [
      [2700, 12500, 6000],
      [2700, 12500, 51000],
      [20000, 5000, 100000],
    ],
  });

const unionLimits = (u: Universe): Block =>
  facts(
    UNION_KEYS.map((key, i) => {
      const setting = unionSettings[i]!;
      const range = UNION_RANGES[key];
      return [
        setting.label,
        `${number(value(u, setting.key))} (von ${number(range.min)} bis ${number(range.max)})`,
      ];
    }),
  );

const cutoffWords = (u: Universe): string => {
  const cutoff = value(u, unionSettings[2].key);
  return cutoff > 0
    ? `In den letzten ${minutes(cutoff)} vor der Ankunft tritt niemand mehr bei.`
    : 'Eine Sperre kurz vor der Ankunft gibt es in dieser Runde nicht.';
};

const unionOpen = (): PageSection =>
  section(
    'union-open',
    'Verbandsangriff: eröffnen, einladen, beitreten',
    say(
      'Einen Angriffsverband eröffnest du aus einem eigenen [[mission-attack|Sturmangriff]], der noch unterwegs ist: nicht zurückgerufen, noch nicht angekommen und in keinem Verband. Dieser Angriff führt den Verband an. Der Anführer lädt Verbündete mit Namen ein, nicht den Besitzer des Ziels; die Eingeladenen zählen schon gegen die Grenze der Spieler. Wer Verbündeter ist, bestimmt dieselbe Einstellung wie bei der Wache. Beitreten heißt, einen Sturmangriff auf dasselbe Ziel zu schicken, mit allen Prüfungen eines Angriffs: Schiffe, Treibstoff, Flottenslots, Urlaubsmodus und Schutz des Ziels. Der Anführer und wer schon im Verband ist, braucht keine Einladung, alle anderen schon; ein Spieler darf mehrere Flotten schicken. Ein Spieler im Urlaubsmodus kann nicht beitreten.',
    ),
  );

const unionTiming = (s: LexState): PageSection =>
  section(
    'union-timing',
    'Ankunft, Geschwindigkeit und Grenzen',
    say(
      'Ein Verband hat eine feste Ankunftszeit. Alle Flotten eines Verbands kommen genau dann an und kämpfen in einem Kampf als mehrere Angreifer, jede mit der Forschung ihres Besitzers; die Flotte des Anführers führt. Eine Flotte, die beitritt, startet sofort: Ihre Geschwindigkeit liegt zwischen {slowest} und {fastest}, auch zwischen den Stufen, sodass sie genau zur Ankunft des Verbands da ist, und ihr Treibstoff richtet sich nach dieser Geschwindigkeit. Wäre sie selbst mit {slowest} zu früh da, wird sie abgelehnt, und die Meldung nennt, wann du sie frühestens losschicken kannst; erreicht sie das Ziel selbst mit {fastest} nicht rechtzeitig, wird sie ebenfalls abgelehnt. {cutoff} Ein Verband, der angekommen ist, ist geschlossen. Eine beigetretene Flotte kehrt nach der Dauer ihres eigenen Flugs zurück.',
      {
        slowest: `${number(SLOWEST * 10)} %`,
        fastest: `${number(FASTEST * 10)} %`,
        cutoff: cutoffWords(s.u),
      },
    ),
    speedFormula(),
    unionLimits(s.u),
  );

const lootFormula = (): Block =>
  formulas({
    text: 'Anteil einer Flotte an der Beute = ⌊Beute · freier Laderaum der Flotte ÷ freier Laderaum aller Flotten⌋, die übrigen Einheiten gehen der Reihe nach an die ersten Flotten, die noch Platz haben',
    fn: (loot, free1, free2) =>
      Math.floor((loot! * free2!) / (free1! + free2!)),
    rule: (loot, free1, free2) =>
      splitLoot({ m: loot!, c: 0, d: 0 }, [free1!, free2!])[1]!.m,
    samples: [
      [100000, 50000, 50000],
      [100001, 30000, 90000],
      [7, 10, 20],
    ],
  });

const unionLootRecall = (): PageSection =>
  section(
    'union-loot',
    'Beute und Rückruf',
    say(
      'Es gibt eine einzige Beute wie bei einem einzelnen Angreifer; sie reicht höchstens so weit, wie der freie Laderaum aller überlebenden Schiffe zusammen. Sie wird nach dem freien Laderaum auf die Flotten verteilt; keine Flotte bekommt mehr, als sie tragen kann, und was nirgends Platz findet, wird nicht ausgegeben. Jede Flotte behält ihre eigene Ladung und fliegt damit heim; eine Flotte ohne Überlebende ist verloren.',
    ),
    lootFormula(),
    say(
      'Ruft der Anführer seine Flotte zurück, ist der Angriff für alle aufgelöst und alle Flotten kehren um; die anderen Besitzer bekommen einen Bericht. Ruft ein Teilnehmer seine Flotte zurück, kehrt nur sie um und verlässt den Verband, die Ankunft des Verbands bleibt. Gegen den ganzen Verband verteidigen auch die Flotten, die am Ziel Wache halten, jede als eigene Partei; eine eigene Flotte eines Spielers des Verbands, die dort Wache hält, bleibt aus dem Kampf. Der Mondbruch, die Raketen und die Auspex-Erkundung kennen keinen Verband. Der Verteidiger sieht jede Flotte wie sonst auch, aber nichts vom Verband.',
    ),
  );

const page: PageDef = {
  id: 'rule-allies',
  kind: 'rule',
  title: 'Wache stellen und Verbandsangriff',
  line: 'Wer an einem fremden Planeten Wache halten darf, was die Wache tut und wie mehrere Spieler gemeinsam angreifen.',
  keywords: ['Wache', 'verteidigen', 'Verband', 'gemeinsam', 'Beute'],
  seeAlso: [
    'mission-hold',
    'mission-attack',
    'rule-battle',
    'rule-guilds',
    'rule-vacation',
    'rule-universe',
  ],
  sections: (s) => [
    guardWho(s),
    guardFights(),
    guardLeaves(),
    unionOpen(),
    unionTiming(s),
    unionLootRecall(),
  ],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 120, page };
