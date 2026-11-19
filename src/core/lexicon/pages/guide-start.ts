// The guide „Erste Schritte“ (#289): the first days in steps, each linked
// with its articles. The numbers come from the catalog, the universe and the
// rules; the words are a draft of Claude for the owner to check ([V], #289,
// D1 and D3 as recommended).
import { BUILD, SHIPS } from '../../catalog.ts';
import { lvlCost } from '../../economy.ts';
import { fieldsOf, HOME_DIAMETER } from '../../fields.ts';
import { costText, number, requires, say, section, steps } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** The cost of the first level of a building, as words. */
const first = (key: string): string => costText(lvlCost(BUILD[key]!, 1));

const beginSection = (s: LexState): PageSection =>
  section(
    'begin',
    'Womit du beginnst',
    say(
      'Du beginnst mit einem Heimatplaneten, der {fields} Felder hat, und mit {resources}. In diesem Universum läuft alles {speed}-mal so schnell wie im Original. Der Heimatplanet fördert von Anfang an eine Grundmenge, auch ohne Gebäude ([[rule-production]]).',
      {
        fields: number(fieldsOf(HOME_DIAMETER)),
        resources:
          costText([s.u.startMetal, s.u.startCrystal, s.u.startDeuterium]) ||
          'keinen Rohstoffen',
        speed: number(s.u.speed),
      },
    ),
  );

const stepsSection = (): PageSection =>
  section(
    'steps',
    'Die ersten Tage in Schritten',
    steps(
      `Baue die [[metal|Adamant-Tiefbohrung]] und den [[crystal|Psikristall-Steinbruch]]. Die erste Stufe kostet ${first('metal')} beziehungsweise ${first('crystal')}. Ohne Förderstätten kommt nur die Grundmenge herein.`,
      `Baue die [[solar|Sonnenkathedrale]] (erste Stufe: ${first('solar')}). Die Förderstätten brauchen Energie, und fehlt sie, fördern sie weniger ([[rule-production]]).`,
      `Baue das [[lab|Scholarium]] (erste Stufe: ${first('lab')}), denn ohne es lässt sich nichts erforschen. Die [[spy|Auspex-Lehre]] etwa braucht ${requires('spy')}.`,
      'Baue die [[robot|Servitorenschmiede]]: Sie verkürzt jede Bauzeit. Es läuft immer nur ein Bauauftrag je Planet, und eine Forschung zugleich ([[rule-queues]]).',
      'Sobald ein Lager voll ist, hört seine Förderung auf. Baue dann das Lager aus: [[smetal|Adamant-Gewölbe]], [[scrystal|Psikristall-Reliquiar]] oder [[sdeut|Promethium-Zisterne]].',
      `Baue die [[yard|Orbitale Schiffsschmiede]], sie braucht ${requires('yard')}, und danach dein erstes Schiff, etwa einen [[sc|Frachtläufer]] (${costText(SHIPS.sc!.cost)}).`,
      'Schicke deine erste Flotte ([[guide-fleet]]) und gründe deine erste Kolonie ([[guide-colony]]). Was dich im Spiel schützt, steht unter [[guide-defense]].',
      'Sieh unter [[guide-next]] nach, was dein Stand als Nächstes nahelegt.',
    ),
  );

export const page: PageDef = {
  id: 'guide-start',
  kind: 'guide',
  title: 'Erste Schritte',
  line: 'Die ersten Tage in Schritten: Förderung, Energie, Forschung, Lager und die erste Flotte.',
  keywords: ['Anfang', 'Einstieg', 'beginnen', 'Neuling', 'Tutorial'],
  seeAlso: ['rule-production', 'rule-queues', 'rule-universe', 'faq-resources'],
  sections: (s) => [beginSection(s), stepsSection()],
};
