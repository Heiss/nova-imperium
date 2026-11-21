// The guide „Deine erste Flotte“ (#289): the steps from the first ship to the
// report, and which mission goes with which target. The numbers come from
// the rules of the missions; the words are a draft of Claude for the owner to
// check ([V], #289, D1 and D3 as recommended).
import { MISSION, missionRules } from '../../missions.ts';
import { say, section, steps, table } from '../say.ts';
import { TARGET_NAMES } from '../targets.ts';
import type { PageDef, PageSection } from '../types.ts';

const yes = (b: boolean): string => (b ? 'ja' : 'nein');

const stepsSection = (): PageSection =>
  section(
    'steps',
    'Von Schiff zu Bericht',
    steps(
      'Baue Schiffe in der [[yard|Orbitalen Schiffsschmiede]]. Welche, hängt vom Auftrag ab: Die Tabelle unten nennt zu jedem Auftrag sein Ziel.',
      'Prüfe die Flottenslots: Jede Flotte belegt einen, bis sie wieder da ist ([[faq-slots]]).',
      'Wähle im Flottenformular die Schiffe, das Ziel und den Auftrag. Die Ladung ist durch den Laderaum der Schiffe begrenzt, und das Promethium für den Flug zahlst du beim Start ([[rule-flight]]).',
      'Wähle das Tempo. Langsamer zu fliegen spart Promethium und kostet Zeit; die Flotte ist so schnell wie ihr langsamstes Schiff ([[rule-flight]]).',
      'Warte auf den Bericht in den Nachrichten. Bei einem Angriff erfährst du, was der Kampf gebracht hat ([[faq-aftermath]]).',
    ),
  );

const missionsSection = (): PageSection =>
  section(
    'missions',
    'Welcher Auftrag für welches Ziel',
    table(
      'Die Aufträge der Flotte und ihre Ziele',
      ['Auftrag', 'Ziel', 'Ladung', 'Rückflug'],
      Object.entries(MISSION).flatMap(([key, title]) => {
        const rules = missionRules(key)!;
        // Missiles start from the silo, not from the fleet form.
        if (rules.launch === 'missiles') return [];
        return [
          [
            { text: title, link: `mission-${key}` },
            TARGET_NAMES[rules.target],
            yes(rules.cargo),
            yes(rules.returns),
          ],
        ];
      }),
    ),
    say(
      'Eine Erkundung zeigt vorher, was am Ziel steht ([[faq-intel]]). Warum ein Auftrag nicht geht, steht unter [[faq-attack]].',
    ),
  );

export const page: PageDef = {
  id: 'guide-fleet',
  kind: 'guide',
  title: 'Deine erste Flotte',
  line: 'Vom ersten Schiff bis zum Bericht, und welcher Auftrag zu welchem Ziel passt.',
  keywords: ['Flotte', 'Schiffe', 'starten', 'schicken', 'Auftrag'],
  seeAlso: ['rule-flight', 'rule-battle', 'faq-slots', 'mission-transport'],
  sections: () => [stepsSection(), missionsSection()],
};
