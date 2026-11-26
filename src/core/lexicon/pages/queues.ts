// The rule page „Bauen, Forschen und Schiffsschmiede“ (#288): how long an
// order takes and how many run at once, and what cancelling gives back. The
// numbers come from `src/core/economy.ts` and `economy-checks.ts`; the words
// are a draft of Claude for the owner to check ([V], #288).
import { buildTime, researchTime, unitTime } from '../../economy.ts';
import { MAX_SHIPYARD_ORDERS } from '../../economy-checks.ts';
import type { Universe } from '../../types.ts';
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

const ROBOTS = [0, 5, 10, 20];
const NANITES = [0, 1, 2, 3];

/** The universe of a sample: only its speed counts for a time. */
const at = (speed: number): Universe => ({ speed }) as Universe;

/** The time of a build order at the levels of the factories, relative to none. */
const relative = (robot: number, nanite: number): number =>
  buildTime([100000, 0, 0], { b: { robot, nanite } }, at(1)) /
  buildTime([100000, 0, 0], { b: {} }, at(1));

const buildSection = (): PageSection =>
  section(
    'build',
    'Gebäude',
    say(
      'Auf jedem Planeten läuft eine Bauschleife: Ein Gebäude wird um eine Stufe ausgebaut, dann das nächste. Die Kosten werden beim Start bezahlt; brichst du den Auftrag ab, bekommst du sie voll zurück. Die Bauzeit hängt von den Kosten der Stufe ab, und jede Stufe der [[robot|Servitorenschmiede]] beschleunigt sie, jede der [[nanite|Machina-Schwarmhalle]] halbiert sie. Eine Stufe dauert mindestens eine Sekunde, und das Tempo des Universums teilt jede Zeit.',
    ),
    formulas({
      text: 'Bauzeit in Stunden = (Adamant + Psikristall der Stufe) ÷ (2.500 · (1 + Stufe der Servitorenschmiede) · 2^Stufe der Machina-Schwarmhalle) ÷ Tempo des Universums',
      fn: (m, c, robot, nanite, speed) =>
        Math.max(
          1000,
          Math.ceil(
            (((m! + c!) / (2500 * (1 + robot!) * 2 ** nanite!)) * 3600000) /
              speed!,
          ),
        ),
      rule: (m, c, robot, nanite, speed) =>
        buildTime(
          [m!, c!, 0],
          { b: { robot: robot!, nanite: nanite! } },
          at(speed!),
        ),
      samples: [
        [60, 15, 0, 0, 1],
        [48000, 24000, 6, 1, 5],
        [1_000_000, 500_000, 20, 3, 40],
        [10, 10, 0, 0, 100],
      ],
    }),
    table(
      'Bauzeit im Verhältnis zu einem Planeten ohne beide Gebäude',
      [
        `Stufe der ${nameOf('robot')}`,
        ...NANITES.map((n) => `${nameOf('nanite')} Stufe ${n}`),
      ],
      ROBOTS.map((robot) => [
        robot,
        ...NANITES.map((nanite) => percent(relative(robot, nanite))),
      ]),
    ),
  );

const researchSection = (): PageSection =>
  section(
    'research',
    'Forschung',
    say(
      'Es läuft immer nur eine Forschung zugleich, für alle deine Planeten zusammen. Sie braucht ein [[lab|Scholarium]]; jede Stufe davon beschleunigt sie, aber solange es ausgebaut wird, ruht die Forschung, und es lässt sich nicht ausbauen, solange geforscht wird. Wie bei Gebäuden bekommst du die Kosten voll zurück, wenn du abbrichst.',
    ),
    formulas({
      text: 'Forschungszeit in Stunden = (Adamant + Psikristall der Stufe) ÷ (1.000 · (1 + Stufe des Scholariums)) ÷ Tempo des Universums',
      fn: (m, c, lab, speed) =>
        Math.max(
          1000,
          Math.ceil((((m! + c!) / (1000 * (1 + lab!))) * 3600000) / speed!),
        ),
      rule: (m, c, lab, speed) =>
        researchTime([m!, c!, 0], { b: { lab: lab! } }, at(speed!)),
      samples: [
        [200, 100, 1, 1],
        [48000, 24000, 6, 5],
        [1_000_000, 500_000, 20, 40],
      ],
    }),
  );

const yardSection = (): PageSection =>
  section(
    'yard',
    'Schiffsschmiede',
    say(
      'Die [[yard|Orbitale Schiffsschmiede]] arbeitet ihre Aufträge nacheinander ab; die Liste fasst höchstens {orders} Aufträge, Schiffe und Verteidigung zusammen. Jede Stufe der Schiffsschmiede und der Machina-Schwarmhalle verkürzt die Zeit je Stück. Solange sie oder die Machina-Schwarmhalle ausgebaut werden, arbeitet die Schiffsschmiede nicht, und ihr Ausbau wartet auf eine leere Liste.',
      { orders: number(MAX_SHIPYARD_ORDERS) },
    ),
    formulas({
      text: 'Zeit je Stück in Stunden = (Adamant + Psikristall des Stücks) ÷ (2.500 · (1 + Stufe der Orbitalen Schiffsschmiede) · 2^Stufe der Machina-Schwarmhalle) ÷ Tempo des Universums',
      fn: (m, c, yard, nanite, speed) =>
        Math.max(
          1000,
          Math.ceil(
            (((m! + c!) / (2500 * (1 + yard!) * 2 ** nanite!)) * 3600000) /
              speed!,
          ),
        ),
      rule: (m, c, yard, nanite, speed) =>
        unitTime(
          { cost: [m!, c!, 0] },
          { b: { yard: yard!, nanite: nanite! } },
          at(speed!),
        ),
      samples: [
        [3000, 1000, 2, 0, 1],
        [60000, 30000, 8, 2, 5],
        [5_000_000, 2_000_000, 20, 3, 40],
      ],
    }),
    say(
      'Einen Auftrag kannst du jederzeit abbrechen: Alle Stücke des Auftrags, die noch nicht fertig sind, werden voll erstattet, auch das, an dem gerade gearbeitet wird; dessen Fortschritt geht verloren. Fertige Stücke bleiben auf dem Planeten. Wird der erste Auftrag abgebrochen, beginnt der nächste sofort.',
    ),
  );

const page: PageDef = {
  id: 'rule-queues',
  kind: 'rule',
  title: 'Bauen, Forschen und Schiffsschmiede',
  line: 'Wie lange ein Auftrag dauert, wie viele gleichzeitig laufen und was ein Abbruch zurückgibt.',
  keywords: ['bauen', 'Bauzeit', 'Bauschleife', 'Auftrag', 'abbrechen'],
  seeAlso: ['robot', 'nanite', 'lab', 'yard', 'rule-planets'],
  sections: () => [buildSection(), researchSection(), yardSection()],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 140, page };
