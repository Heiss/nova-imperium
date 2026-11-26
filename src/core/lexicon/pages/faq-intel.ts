// The question „Wie bekomme ich mehr Informationen über den Gegner?“ (#288):
// the answer, the steps and what the player's own Auspex-Lehre and
// Spähschädel show. The numbers come from `src/core/spy.ts` and
// `espionage.ts`; the words are a draft of Claude for the owner to check
// ([V], #288).
import { SPY_MIN_TECH } from '../../espionage.ts';
import {
  probesFor,
  spyParts,
  SPY_LEVELS,
  spyScore,
  type SpyPart,
} from '../../spy.ts';
import { number, requires, say, section, steps, table } from '../say.ts';
import type { PageDef } from '../types.ts';

/** The parts of a report, as the report names them. */
const PARTS: Readonly<Record<SpyPart, string>> = {
  ships: 'Flotte',
  def: 'Verteidigung',
  b: 'Gebäude',
  r: 'Forschung',
};

const page: PageDef = {
  id: 'faq-intel',
  kind: 'question',
  title: 'Wie bekomme ich mehr Informationen über den Gegner?',
  line: 'Mit der Auspex-Lehre und Spähschädeln: Je mehr du schickst und je weiter du in der Auspex-Lehre vorn liegst, desto mehr zeigt der Bericht.',
  keywords: ['Gegner', 'ausspähen', 'Informationen', 'Bericht', 'Spähschädel'],
  seeAlso: ['rule-spy', 'spy', 'probe', 'mission-spy', 'rule-vision'],
  sections: (s) => {
    const level = s.research.spy ?? 0;
    const probes = s.ships.probe ?? 0;
    const stand = spyParts(spyScore(probes, 0)).map((p) => PARTS[p]);
    return [
      section(
        'answer',
        'Kurz gesagt',
        say(
          'Erforsche die [[spy|Auspex-Lehre]] und schicke [[probe|Spähschädel]] in einer [[mission-spy|Auspex-Erkundung]] zum Ziel. Der Bericht nennt immer die Rohstoffe; Flotte, Verteidigung, Gebäude und Forschung kommen dazu, wenn dein Auspex-Wert hoch genug ist. Den Auspex-Wert heben mehr Spähschädel und ein Vorsprung in der Auspex-Lehre vor dem Ziel.',
        ),
      ),
      section(
        'steps',
        'Schritte',
        steps(
          `Erforsche die [[spy|Auspex-Lehre]] bis mindestens Stufe ${number(SPY_MIN_TECH)}. Sie braucht ${requires('spy')}.`,
          `Baue Spähschädel in der [[yard|Orbitalen Schiffsschmiede]]. Sie brauchen ${requires('probe')}.`,
          'Wähle auf der Sternenkarte den Planeten oder Mond des Gegners und starte die Auspex-Erkundung. Wie viele Spähschädel sie schickt, stellst du in den Optionen ein.',
          'Öffne den Bericht in deinen Nachrichten. Zeigt er nicht alles, schicke mehr Spähschädel oder forsche weiter in der Auspex-Lehre.',
        ),
      ),
      section(
        'values',
        'Was du dafür brauchst',
        say(
          'Die Tabelle nennt, wie viele Spähschädel du gegen ein Ziel mit gleicher Auspex-Lehre brauchst, damit der Bericht den Teil zeigt. Mit jeder Stufe Vorsprung brauchst du weniger, mit jeder Stufe Rückstand mehr; die Zahlen im Einzelnen stehen unter [[rule-spy]].',
        ),
        table(
          'Spähschädel bis zum Teil des Berichts, bei gleicher Auspex-Lehre',
          ['Teil des Berichts', 'Ab Auspex-Wert', 'Spähschädel'],
          SPY_LEVELS.map(([min, part]) => [
            PARTS[part],
            min,
            probesFor(min, 0),
          ]),
        ),
        {
          t: 'stand',
          text: `Dein Stand: Stufe ${number(level)} der Auspex-Lehre und ${number(probes)} Spähschädel. Gegen ein Ziel mit gleicher Auspex-Lehre zeigt dein Bericht: Rohstoffe${stand.length ? `, ${stand.join(', ')}` : ''}.`,
        },
      ),
    ];
  },
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 250, page };
