// The rule page „Auspex-Erkundung“ (#288): the Auspex-Wert of a report, what
// it shows, the chance of the Auspex-Abwehr and what a detection brings. The
// numbers come from `src/core/spy.ts`, `espionage.ts` and the round; the
// words are a draft of Claude for the owner to check ([V], #288).
import {
  counterMax,
  MAX_CHANCE,
  PROBE_DIVISOR,
  SHIP_DIVISOR,
  SPY_MIN_TECH,
} from '../../espionage.ts';
import { spyScore, SPY_LEVELS, type SpyPart } from '../../spy.ts';
import { formulas, number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** The parts of a report, as the report names them. */
const PARTS: Readonly<Record<SpyPart, string>> = {
  ships: 'Flotte',
  def: 'Verteidigung',
  b: 'Gebäude',
  r: 'Forschung',
};

const PROBES = [1, 4, 12, 40];
const LEADS = [-2, -1, 0, 1, 2];

const lead = (n: number): string =>
  n > 0 ? `Du führst um ${n}` : n < 0 ? `Ziel führt um ${-n}` : 'Gleichstand';

const reportSection = (s: LexState): PageSection =>
  section(
    'report',
    'Was ein Bericht zeigt',
    say(
      'Eine Auspex-Erkundung fliegt nur mit Spähschädeln und braucht mindestens Stufe {min} der [[spy|Auspex-Lehre]]. Ihr Bericht nennt die Rohstoffe des Ziels immer; was er sonst noch zeigt, hängt vom Auspex-Wert ab. Der Auspex-Wert zählt jeden Spähschädel einmal und deinen Vorsprung in der Auspex-Lehre im Quadrat. Liegt das Ziel vorn, zählt sein Vorsprung ebenso im Quadrat, aber gegen dich. Gezählt werden die Spähschädel, die ankommen, und die Auspex-Lehre beider Seiten bei der Ankunft.',
      { min: number(SPY_MIN_TECH) },
    ),
    formulas({
      text: 'Auspex-Wert = Spähschädel + Vorsprung · |Vorsprung|',
      fn: (probes, diff) => probes! + diff! * Math.abs(diff!),
      rule: spyScore,
      samples: [
        [1, 0],
        [4, 2],
        [12, -3],
        [40, 1],
      ],
    }),
    table(
      'Auspex-Wert nach Spähschädeln und Vorsprung in der Auspex-Lehre',
      ['Spähschädel', ...LEADS.map(lead)],
      PROBES.map((probes) => [
        probes,
        ...LEADS.map((diff) => spyScore(probes, diff)),
      ]),
    ),
    say(
      'Je höher der Auspex-Wert, desto mehr steht im Bericht. Die Tabelle nennt, ab welchem Auspex-Wert ein Teil dazukommt.',
    ),
    table(
      'Was der Bericht ab welchem Auspex-Wert zeigt',
      ['Teil', 'ab Auspex-Wert'],
      [
        ['Rohstoffe', 'immer'],
        ...SPY_LEVELS.map(([min, part]) => [PARTS[part], min]),
      ],
    ),
    say(
      'Flotten, die am Ziel Wache halten, zählt der Bericht zunächst zur Flotte des Planeten. Ab Stufe {held} der Auspex-Lehre zeigt er sie getrennt unter der Überschrift ‚Gehaltene Flotten‘. Der Bericht nennt auch, wie aktiv das Ziel zuletzt war ([[rule-vision]]).',
      { held: number(s.round.heldSpy) },
    ),
  );

const counterSection = (): PageSection =>
  section(
    'counter',
    'Auspex-Abwehr',
    say(
      'Bei jeder Erkundung kann das Ziel deine Spähschädel entdecken. Die Chance wird jedes Mal neu zwischen null und einem Höchstwert ausgelost. Der Höchstwert steigt mit der Zahl der Spähschädel, mit den Schiffen am Ziel und mit der Auspex-Lehre des Ziels, und er sinkt mit deiner eigenen. Ein Ziel ohne Auspex-Lehre entdeckt nie etwas, und über {cap} kommt der Höchstwert nicht. Die Tabelle im Artikel der [[spy|Auspex-Lehre]] zeigt ihn für Beispiele.',
      { cap: `${number(MAX_CHANCE)} %` },
    ),
    formulas({
      text: 'Höchste Chance in % = Spähschädel ÷ {probes} · Auspex-Lehre des Ziels ÷ deine Auspex-Lehre · (1 + Schiffe am Ziel ÷ {ships}), höchstens {cap}',
      values: {
        probes: number(PROBE_DIVISOR),
        ships: number(SHIP_DIVISOR),
        cap: number(MAX_CHANCE),
      },
      fn: (probes, ships, target, spy) =>
        Math.min(
          MAX_CHANCE,
          (probes! / PROBE_DIVISOR) *
            (target! / spy!) *
            (1 + ships! / SHIP_DIVISOR),
        ),
      rule: (probes, ships, target, spy) =>
        counterMax({
          probes: probes!,
          ships: ships!,
          target: target!,
          spy: spy!,
        }),
      samples: [
        [1, 0, 1, 1],
        [12, 50, 3, 2],
        [40, 1000, 9, 1],
        [4, 10, 2, 5],
      ],
    }),
    say(
      'Wird die Erkundung entdeckt, kämpfen die Spähschädel wie in einem [[rule-battle|Kampf]] gegen die Schiffe und die Verteidigung des Ziels und gegen Flotten, die dort Wache halten. Nur Spähschädel, die den Kampf überleben, bringen einen Bericht. Hat das Ziel weder Schiffe noch Verteidigung noch Wache haltende Flotten, gibt es keinen Kampf, und die Spähschädel berichten wie sonst. Der Verteidiger erfährt in jedem Fall, von wo er erkundet wurde und wie hoch die ausgeloste Chance war.',
    ),
  );

const targetsSection = (): PageSection =>
  section(
    'targets',
    'Wen du erkunden darfst',
    say(
      'Erkunden lassen sich fremde Planeten und Monde. Wer unter [[rule-protection|Noobschutz]] steht oder im [[rule-vacation|Urlaubsmodus]] ist, lässt sich nicht erkunden.',
    ),
  );

const page: PageDef = {
  id: 'rule-spy',
  kind: 'rule',
  title: 'Auspex-Erkundung',
  line: 'Was ein Auspex-Bericht zeigt, wann deine Spähschädel entdeckt werden und was dann geschieht.',
  keywords: ['ausspähen', 'Gegner', 'Bericht', 'Späher', 'entdeckt'],
  seeAlso: ['spy', 'probe', 'mission-spy', 'faq-intel', 'rule-protection'],
  sections: (s) => [reportSection(s), counterSection(), targetsSection()],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 20, page };
