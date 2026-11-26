// The rule page „Kampf“ (#288): the rounds, hits, rapid fire, the research
// bonus, the values of every unit, the loot and the rebuilt defense. Every
// number is read from `src/core/battle.ts`, `loot.ts` and the catalog; the
// words are a draft of Claude for the owner to check ([V], #288).
import {
  againChance,
  EXPLODES_BELOW,
  MAX_ROUNDS,
  rapid,
  SHIELD_IGNORED,
  TECH_BONUS,
  techFactor,
} from '../../battle.ts';
import { FIGHTERS } from '../../catalog.ts';
import { EASY_RAPID_FIRE, strength } from '../../components/combat.ts';
import {
  LOOT_SHARE,
  plunder,
  REBUILD_DRAWN_BELOW,
  REBUILD_SHARE,
} from '../../loot.ts';
import {
  formulas,
  nameOf,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { PageDef, PageSection } from '../types.ts';

/** The units that fight, ships first, as the catalog lists them. */
const KEYS = Object.keys(FIGHTERS);

/** The rapid fire of every unit that has any: its targets with the value. */
const rapidRows = (): [string, string][] =>
  KEYS.flatMap((a) => {
    const against = KEYS.filter((t) => rapid(a, t) > 1).map(
      (t) => `${nameOf(t)} ${number(rapid(a, t))}`,
    );
    return against.length ? [[a, against.join(', ')] as [string, string]] : [];
  });

/** The units that every ship has rapid fire against by default. */
const easyTargets = (): string =>
  KEYS.filter((k) => FIGHTERS[k]!.combat.easy)
    .map(nameOf)
    .join(' und ');

const STOCK = { m: 200000, c: 100000, d: 50000 };
const FREE = [10000, 100000, 500000];

const flowSection = (): PageSection =>
  section(
    'flow',
    'So läuft ein Kampf',
    say(
      'Ein Kampf dauert höchstens {rounds} Runden und endet früher, sobald eine Seite keine Einheit mehr hat. In jeder Runde laden die Schilde beider Seiten wieder voll auf, dann schießt jede Einheit auf ein zufällig gewähltes Ziel der Gegenseite. Beide Seiten schießen gleichzeitig: Eine Einheit, die in dieser Runde zerstört wird, hat ihren Schuss trotzdem abgegeben.',
      { rounds: number(MAX_ROUNDS) },
    ),
    say(
      'Ein Schuss trifft zuerst den Schild des Ziels, was der Schild nicht aufhält, geht auf die Struktur. Ein Schuss, der schwächer ist als {skip} des Schilds, den das Ziel gerade noch hat, prallt ab und richtet nichts an. Fällt die Struktur einer Einheit unter {below} ihres Höchstwerts, kann sie explodieren, und zwar umso wahrscheinlicher, je weniger Struktur ihr bleibt.',
      { skip: percent(SHIELD_IGNORED), below: percent(EXPLODES_BELOW) },
    ),
    say(
      'Gewonnen hat, wer nach dem Kampf noch Einheiten hat, während die andere Seite keine mehr hat. Stehen sich nach der letzten Runde noch beide Seiten gegenüber, endet der Kampf unentschieden.',
    ),
  );

const rapidSection = (): PageSection =>
  section(
    'rapid',
    'Schnellfeuer',
    say(
      'Manche Einheiten schießen mit etwas Glück gleich noch einmal: Das Schnellfeuer ist ein Wert je Schütze und getroffene Art von Einheit, und die Chance auf einen weiteren Schuss wächst mit ihm, ohne je sicher zu werden. Jeder weitere Schuss geht auf ein neu gewürfeltes Ziel, und es zählt das Schnellfeuer gegen dieses Ziel. Ein Wert von {example} heißt: {chance} Chance auf noch einen Schuss.',
      {
        example: number(EASY_RAPID_FIRE),
        chance: percent(againChance(EASY_RAPID_FIRE)),
      },
    ),
    formulas({
      text: 'Chance auf einen weiteren Schuss = (Schnellfeuer − 1) ÷ Schnellfeuer',
      fn: (r) => (r! - 1) / r!,
      rule: againChance,
      samples: [[1], [2], [5], [10]],
    }),
    say(
      'Jedes Schiff hat Schnellfeuer {easy} gegen die leichten Ziele ({targets}), wenn es nicht selbst eines ist. Die Tabelle nennt alle Einheiten mit Schnellfeuer und die Ziele, gegen die sie es haben.',
      { easy: number(EASY_RAPID_FIRE), targets: easyTargets() },
    ),
    table(
      'Schnellfeuer der Einheiten',
      ['Einheit', 'Schnellfeuer gegen'],
      rapidRows().map(([a, against]) => [
        { text: nameOf(a), link: a },
        against,
      ]),
    ),
  );

const valuesSection = (): PageSection =>
  section(
    'values',
    'Werte und Forschung',
    say(
      'Angriff, Schild und Struktur einer Einheit steigen mit der Forschung ihres Besitzers: [[weapons]] hebt den Angriff, [[shield]] den Schild, [[armor]] die Struktur aller Schiffe und Verteidigungsanlagen. Jede Stufe legt {bonus} des Grundwerts obendrauf. Flotten, die an einem Planeten Wache halten, kämpfen mit der Forschung ihres eigenen Besitzers.',
      { bonus: percent(TECH_BONUS) },
    ),
    formulas({
      text: 'Wert im Kampf = Grundwert · (1 + {bonus} · Stufe)',
      values: { bonus: percent(TECH_BONUS) },
      fn: (level) => 1 + TECH_BONUS * level!,
      rule: techFactor,
      samples: [[0], [1], [5], [10], [21]],
    }),
    say(
      'Die Struktur einer Einheit ist ein Zehntel ihrer Kosten an Adamant und Psikristall. Die Tabelle zeigt die Grundwerte, ohne Forschung.',
    ),
    table(
      'Werte der Einheiten ohne Forschung',
      ['Einheit', 'Angriff', 'Schild', 'Struktur'],
      KEYS.map((k) => {
        const s = strength(FIGHTERS[k]!);
        return [{ text: nameOf(k), link: k }, s.attack, s.shield, s.hull];
      }),
    ),
  );

const afterSection = (): PageSection =>
  section(
    'after',
    'Nach dem Kampf',
    say(
      'Zerstörte Schiffe beider Seiten hinterlassen ein [[rule-debris|Trümmerfeld]]. Von der zerstörten Verteidigung wird ein Teil wieder aufgebaut: {rebuilt} je Art. Gehen weniger als {drawn} Stück einer Art verloren, wird jedes Stück einzeln ausgelost, ab {drawn} Stück wird der Anteil gerundet. Zerstörte Schiffe werden nie ersetzt, und Raketen kämpfen nicht mit.',
      {
        rebuilt: percent(REBUILD_SHARE),
        drawn: number(REBUILD_DRAWN_BELOW),
      },
    ),
    say(
      'Gewinnt der Angreifer, lädt er bis zu {share} jedes Rohstoffs des Planeten ein, soweit der Laderaum seiner übrigen Schiffe reicht. Der Laderaum wird in fester Reihenfolge gefüllt: zuerst Adamant, dann Psikristall, dann Promethium, und was danach noch Platz hat, füllt wieder mit Adamant und Psikristall auf. Danach nimmt er die Ladung der Flotten mit, die am Planeten Wache gehalten haben, soweit noch Platz ist; diese Flotten sind dann verloren.',
      { share: percent(LOOT_SHARE) },
    ),
    table(
      `Beute bei einem Planeten mit ${number(STOCK.m)} Adamant, ${number(STOCK.c)} Psikristall und ${number(STOCK.d)} Promethium`,
      ['Freier Laderaum', 'Adamant', 'Psikristall', 'Promethium'],
      FREE.map((free) => {
        const loot = plunder(STOCK, free);
        return [free, loot.m, loot.c, loot.d];
      }),
    ),
  );

const page: PageDef = {
  id: 'rule-battle',
  kind: 'rule',
  title: 'Kampf',
  line: 'Wie ein Kampf abläuft, was die Forschung bringt und was danach übrig bleibt.',
  keywords: ['Schlacht', 'Gefecht', 'Schaden', 'Beute', 'Verlust'],
  seeAlso: [
    'weapons',
    'shield',
    'armor',
    'mission-attack',
    'mission-hold',
    'rule-debris',
    'rule-protection',
  ],
  sections: () => [
    flowSection(),
    rapidSection(),
    valuesSection(),
    afterSection(),
  ],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 10, page };
