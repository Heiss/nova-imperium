// The rule page „Warp-Tor und Auspex-Phalanx“ (#288, #53, #230): the jump
// through the Warp-Tor with its cooldown, and the scan of the Auspex-Phalanx
// with its range and price. The numbers come from `src/core/jump-gate.ts` and
// `phalanx.ts`; the words are a draft of Claude for the owner to check ([V],
// #288). The table of the range by level is on the page „Monde“.
import { gateCooldown, gateCooldownMs } from '../../jump-gate.ts';
import { gateFormula } from '../parts.ts';
import { phalanxRange, SCAN_COST } from '../../phalanx.ts';
import { duration, formulas, number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20];

const jumpSection = (): PageSection =>
  section(
    'jump',
    'Der Sprung',
    say(
      'Das [[jumpgate|Warp-Tor]] steht nur auf einem Mond. Ein Sprung geht vom Tor des Mondes, auf dem du gerade bist, zu einem anderen eigenen Mond, auf dem ein Warp-Tor bereit ist. Er verlegt Schiffe sofort und ohne Treibstoff; Rohstoffe bleiben zurück. Es springen nur Schiffe, die fliegen können, also keine Sonnenreliquiare, und du wählst sie aus, höchstens so viele, wie auf dem Mond stehen. Flotten anderer Spieler, die dort Wache halten, bleiben und verteidigen weiter ([[rule-allies]]).',
    ),
    say(
      'Geprüft wird in dieser Reihenfolge: zuerst das Starttor (ein Mond, ein Tor darauf, nicht in Abkühlung), dann das Ziel (ein anderer eigener Mond mit einem Tor, das nicht in Abkühlung ist), dann die Schiffe (mindestens eines, alle fliegend).',
    ),
  );

const cooldownSection = (s: LexState): PageSection =>
  section(
    'cooldown',
    'Wartezeit nach dem Sprung',
    say(
      'Nach einem Sprung kühlen beide Tore ab, das Starttor und das Zieltor, und zwar so lange, wie die Stufe des Starttors es verlangt; die Stufe des Zieltors ändert nichts daran. Die Zeit sinkt mit der Stufe, aber nicht gleichmäßig, und ab einer Stufe nicht mehr. Die Minuten der Tabelle teilt das Universum durch sein Tempo; ein schnelleres kühlt die Tore also schneller ab. Solange ein Tor abkühlt, kann es weder starten noch Ziel eines Sprungs sein.',
    ),
    formulas(gateFormula()),
    table(
      'Wartezeit nach der Stufe des Starttors',
      ['Stufe', 'Minuten', 'Zeit in diesem Universum'],
      LEVELS.map((l) => [l, gateCooldown(l), duration(gateCooldownMs(l, s.u))]),
    ),
  );

const scanSection = (): PageSection =>
  section(
    'scan',
    'Der Scan der Auspex-Phalanx',
    say(
      'Die [[phalanx|Auspex-Phalanx]] steht nur auf einem Mond. Von dort scannst du einen fremden Planeten in Reichweite: Sie zeigt alle Flüge von und zu diesem Planeten, von jedem Spieler, nach Ankunft geordnet, mit Schiffen, Herkunft, Ziel und Ankunft, aber ohne Ladung, Besitzer, Auftrag und Treibstoff. Eine Flotte, die dort Wache hält, zeigt sich als haltend, mit dem Ende ihrer Haltezeit. Flüge des Mondes dieses Planeten gehören nicht dazu. Ein Scan kostet {cost} Promethium auf dem Mond, auch wenn gerade nichts fliegt. Der gescannte Spieler bekommt keinen Bericht und erfährt nichts davon.',
      { cost: number(SCAN_COST.d) },
    ),
    say(
      'Die Reichweite zählt in Systemen, nur in der Galaxie des Mondes und ohne Umlauf um ihr Ende; die Tabelle dazu steht unter [[rule-moons]]. Nicht scannen lassen sich Monde, eigene Planeten und freie Positionen. Auch diese Ablehnungen und ein Ziel außer Reichweite kosten nichts.',
    ),
    formulas({
      text: 'Reichweite in Systemen = Stufe² − 1',
      fn: (level) => level! * level! - 1,
      rule: phalanxRange,
      samples: [[0], [1], [2], [5], [10]],
    }),
  );

export const page: PageDef = {
  id: 'rule-gates',
  kind: 'rule',
  title: 'Warp-Tor und Auspex-Phalanx',
  line: 'Wie Schiffe zwischen eigenen Monden springen, wie lange die Tore danach abkühlen und was ein Scan der Auspex-Phalanx zeigt.',
  keywords: ['Warp', 'springen', 'Scan', 'Wartezeit', 'Phalanx'],
  seeAlso: ['jumpgate', 'phalanx', 'moonbase', 'rule-moons', 'rule-allies'],
  sections: (s) => [jumpSection(), cooldownSection(s), scanSection()],
};
