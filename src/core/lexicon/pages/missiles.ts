// The rule page „Raketen“ (#288, #54): the Raketenkrypta and its places, the
// launch with its range and flight time, and the impact: the Abfangraketen,
// the damage and the order in which it hits. The numbers come from
// `src/core/missiles.ts`, `components/silo.ts` and the catalog; the words are
// a draft of Claude for the owner to check ([V], #288).
import { TECH_BONUS, techFactor } from '../../battle.ts';
import { DEF, MISSILE, SILO } from '../../catalog.ts';
import {
  hullOf,
  INTERCEPTORS,
  missileFlightMs,
  missileRange,
  STRIKER,
  strike,
  TARGETS,
} from '../../missiles.ts';
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
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

/** The one building that stores missiles, and the Abfangrakete that is first in the catalog. */
const SILO_KEY = Object.keys(SILO)[0]!;
const INTERCEPTOR = INTERCEPTORS[0]!;

const LEVELS = [1, 2, 3, 5, 8, 10];
const DISTANCES = [1, 2, 5, 10, 25];
const SALVOS = [1, 5, 10, 25];

/** The Abfangraketen and the places a piece takes, as a word list for a text. */
const names = (keys: readonly string[]): string => keys.map(nameOf).join(', ');

const siloSection = (): PageSection =>
  section(
    'silo',
    'Raketenkrypta und Raketen',
    say(
      'Raketen lagert die [[silo|Raketenkrypta]], und zwar nur auf Planeten, nicht auf einem Mond. Jede Stufe schafft {places} Plätze. Eine [[abm|Abfangrakete]] belegt {interceptor}, eine [[ipm|Orbitalrakete]] {striker}; ein Auftrag, für den der Platz nicht reicht, wird abgelehnt. Gezählt werden die Raketen, die schon lagern, und die, die in der Schiffsschmiede in Auftrag sind. Raketen kämpfen in keinem Kampf mit und zählen nur für die Gesamtpunkte; sie werden gebaut wie Verteidigung. Gelagerte Raketen kannst du in der Verteidigungsliste verschrotten, so viele du willst: Sie sind sofort weg, ihre Plätze werden frei, und du bekommst nichts zurück. Die Raketenkrypta lässt sich nur zurückbauen, solange ihre Plätze danach noch für alle Raketen reichen.',
      {
        places: number(SILO[SILO_KEY]!.slots),
        interceptor: count(MISSILE[INTERCEPTOR]!.slots, 'Platz', 'Plätze'),
        striker: count(MISSILE[STRIKER]!.slots, 'Platz', 'Plätze'),
      },
    ),
    formulas({
      text: 'Platz für Raketen = {places} · Stufe der Raketenkrypta',
      values: { places: number(SILO[SILO_KEY]!.slots) },
      fn: (level) => SILO[SILO_KEY]!.slots * level!,
      rule: (level) => SILO[SILO_KEY]!.slots * level!,
      samples: [[0], [1], [4], [12]],
    }),
  );

/** The flight time of missiles over `systems` systems at a universe speed, in milliseconds. */
const flightOver = (systems: number, speed: number): number =>
  missileFlightMs({ g: 1, s: 1, p: 1 }, { g: 1, s: 1 + systems, p: 1 }, speed);

const launchFormulas = (): Block =>
  formulas(
    {
      text: 'Reichweite in Systemen = 5 · Stufe des {drive}s − 1',
      values: { drive: nameOf('impulse') },
      fn: (impulse) => impulse! * 5 - 1,
      rule: missileRange,
      samples: [[0], [1], [3], [10]],
    },
    {
      text: 'Flugzeit in Sekunden = (30 + 60 · Systeme) ÷ Tempo des Universums',
      fn: (systems, speed) => (30 + 60 * systems!) / speed!,
      rule: (systems, speed) => flightOver(systems!, speed!) / 1000,
      samples: [
        [0, 5],
        [2, 5],
        [10, 40],
        [25, 1],
      ],
    },
  );

const launchSection = (s: LexState): PageSection => {
  const level = s.research.impulse ?? 0;
  return section(
    'launch',
    'Abschuss, Reichweite und Flugzeit',
    say(
      'Orbitalraketen startest du in der Sternenkarte, von einem Planeten, auf dem sie lagern, auf einen fremden Planeten oder Mond in derselben Galaxie. Sie brauchen keinen Flottenslot und lassen sich nicht zurückrufen. Die Reichweite hängt von deinem [[impulse|Plasma-Impulsantrieb]] ab und zählt in Systemen; ohne den Antrieb ist kein Ziel in Reichweite. Der Abschuss wird verweigert, wenn dort kein Planet oder Mond steht, wenn er dir gehört, wenn er außer Reichweite liegt, wenn sein Besitzer im [[rule-vacation|Urlaubsmodus]] ist oder unter dem [[rule-protection|Schutz der Schwachen]] steht. Die Raketen verlassen die Verteidigung des Startplaneten schon beim Abschuss.',
    ),
    launchFormulas(),
    table(
      'Reichweite nach dem Plasma-Impulsantrieb',
      ['Stufe', 'Reichweite in Systemen'],
      LEVELS.map((l) => [l, missileRange(l)]),
      (i) => LEVELS[i] === level,
    ),
    table(
      'Flugzeit nach der Entfernung in diesem Universum',
      ['Systeme', 'Flugzeit'],
      DISTANCES.map((d) => [d, duration(flightOver(d, s.u.speed))]),
    ),
    {
      t: 'stand',
      text: `Dein Stand: Stufe ${number(level)} des Plasma-Impulsantriebs, Reichweite ${missileRange(level) < 0 ? 'keine' : `${number(missileRange(level))} Systeme`}.`,
    },
  );
};

/** What `n` missiles destroy of one defense kind, as the rules have it: no Abfangraketen, no research. */
const destroyedOf = (key: string, n: number): number =>
  strike(n, { def: { [key]: 1e9 }, interceptors: {} }, key, {
    weapons: 0,
    armor: 0,
  }).destroyed[key] ?? 0;

const damageFormula = (): Block =>
  formulas({
    text: 'Zerstörte Stücke der Hauptziel-Art = ⌊(Raketen − abgefangene) · {attack} · (1 + {bonus} · Stufe der {weapons}) ÷ (Struktur · (1 + {bonus} · Stufe der {armor}))⌋, höchstens so viele, wie da sind',
    values: {
      attack: number(DEF[STRIKER]!.atk),
      bonus: number(TECH_BONUS),
      weapons: nameOf('weapons'),
      armor: nameOf('armor'),
    },
    fn: (n, caught, weapons, armor, k) =>
      Math.floor(
        ((n! - Math.min(n!, caught!)) *
          DEF[STRIKER]!.atk *
          techFactor(weapons!)) /
          (hullOf(TARGETS[k!]!) * techFactor(armor!)),
      ),
    rule: (n, caught, weapons, armor, k) =>
      strike(
        n!,
        {
          def: { [TARGETS[k!]!]: 1e9 },
          interceptors: { [INTERCEPTOR]: caught! },
        },
        TARGETS[k!]!,
        { weapons: weapons!, armor: armor! },
      ).destroyed[TARGETS[k!]!] ?? 0,
    samples: [
      [10, 0, 0, 0, 0],
      [10, 3, 2, 1, 1],
      [25, 25, 5, 5, 2],
      [40, 5, 8, 3, 0],
      [7, 0, 4, 0, TARGETS.length - 1],
    ],
  });

const impactSection = (): PageSection =>
  section(
    'impact',
    'Der Einschlag',
    say(
      'Am Ziel hält jede Abfangrakete des Verteidigers eine Orbitalrakete auf, an einem Mond die Abfangraketen seines Planeten. Die übrigen Raketen richten Schaden an, und zwar nur an Verteidigung, die im Kampf mitkämpft; Schilde zählen nicht. Der Schaden geht zuerst auf das Hauptziel, wenn du beim Abschuss eines wählst, danach auf alle Arten der Reihe nach: {order}. Ein Stück ist zerstört, wenn der Schaden seine ganze Struktur deckt; was für ein weiteres Stück nicht reicht, geht an die nächste Art. Angriff und Struktur steigen mit der Forschung: [[weapons]] beim Angreifer, [[armor]] beim Verteidiger, je {bonus} des Grundwerts je Stufe.',
      { order: names(TARGETS), bonus: percent(TECH_BONUS) },
    ),
    damageFormula(),
    table(
      'Struktur und Zerstörung als Hauptziel, ohne Forschung und ohne Abfangraketen',
      [
        'Verteidigung',
        'Struktur',
        ...SALVOS.map((n) => count(n, 'Orbitalrakete', 'Orbitalraketen')),
      ],
      TARGETS.map((key) => [
        { text: nameOf(key), link: key },
        hullOf(key),
        ...SALVOS.map((n) => destroyedOf(key, n)),
      ]),
    ),
    say(
      'Ist keine Verteidigung mehr übrig, geht der Rest des Schadens auf die Raketen, die in der [[silo|Raketenkrypta]] des Ziels lagern, in der Reihenfolge des Katalogs ({stored}); Abfangraketen, die schon eine Orbitalrakete aufgehalten haben, sind dabei nicht mehr da. Zerstörte Verteidigung wird nicht wieder aufgebaut und hinterlässt kein Trümmerfeld. Beide Seiten bekommen einen Bericht. Steht bei der Ankunft kein fremder Planet oder Mond mehr an der Position, sind die Raketen verloren.',
      { stored: names(Object.keys(MISSILE)) },
    ),
  );

export const page: PageDef = {
  id: 'rule-missiles',
  kind: 'rule',
  title: 'Raketen',
  line: 'Wo Raketen lagern, wie weit und wie schnell sie fliegen und was sie am Ziel zerstören.',
  keywords: [
    'Raketen',
    'Raketenkrypta',
    'Abfangraketen',
    'Reichweite',
    'Schaden',
  ],
  seeAlso: [
    'silo',
    'abm',
    'ipm',
    'impulse',
    'mission-missile',
    'rule-battle',
    'rule-protection',
    'rule-vacation',
  ],
  sections: (s) => [siloSection(), launchSection(s), impactSection()],
};
