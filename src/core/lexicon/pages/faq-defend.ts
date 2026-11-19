// The question „Wie schütze ich mich vor Angriffen?“ (#288): what the rules
// give a defender. The numbers come from the rules named in each line; the
// words are a draft of Claude for the owner to check ([V], #288).
import { TECH_BONUS } from '../../battle.ts';
import { recognitionOf } from '../../fleet-recognition.ts';
import { REBUILD_SHARE } from '../../loot.ts';
import { PROTECTION_RATIO } from '../../protection.ts';
import { facts, number, percent, say, section } from '../say.ts';
import type { PageDef } from '../types.ts';

export const page: PageDef = {
  id: 'faq-defend',
  kind: 'question',
  title: 'Wie schütze ich mich vor Angriffen?',
  line: 'Mit Verteidigung, Forschung, Wache haltenden Freunden und rechtzeitigem Wissen, wer kommt.',
  keywords: ['verteidigen', 'schützen', 'Schutz', 'Abwehr', 'Angriffe'],
  seeAlso: ['rule-battle', 'rule-protection', 'mission-hold', 'rule-vision'],
  sections: (s) => [
    section(
      'answer',
      'Kurz gesagt',
      say(
        'Ganz verhindern lässt sich ein Angriff nicht, aber du kannst ihn teuer machen. Verteidigung, Forschung und Freunde, die bei dir Wache halten, kämpfen mit dir. Wer zu schwach ist, steht außerdem unter Schutz.',
      ),
      facts([
        [
          'Verteidigung',
          `Baue Verteidigungsanlagen, etwa die [[rl|Raketenbatterie]] oder den [[ssd|Kleinen Schutzdom]]. Nach einem Kampf werden ${percent(REBUILD_SHARE)} der zerstörten Verteidigung wieder aufgebaut ([[rule-battle]]).`,
        ],
        [
          'Forschung',
          `[[weapons|Waffensegnung]], [[shield|Refraktionsfelder]] und [[armor|Adamant-Panzerung]] heben Angriff, Schild und Struktur aller deiner Einheiten um ${percent(TECH_BONUS)} je Stufe.`,
        ],
        [
          'Wache',
          'Gildenmitglieder und Freunde können mit ihrer Flotte an deinem Planeten Wache halten und kämpfen dann mit dir, wenn jemand dich angreift ([[mission-hold]]).',
        ],
        [
          'Wissen',
          `Ab Stufe ${number(recognitionOf(s.round).total)} der [[spy|Auspex-Lehre]] siehst du, wie viele Schiffe auf dich zufliegen, ab Stufe ${number(recognitionOf(s.round).types)} welche Arten und ab Stufe ${number(recognitionOf(s.round).counts)} die genaue Zahl ([[rule-vision]]). Eine hohe Auspex-Lehre macht es außerdem wahrscheinlicher, dass du eine Auspex-Erkundung bemerkst ([[rule-spy]]).`,
        ],
        [
          'Raketen',
          'Abfangraketen halten anfliegende Orbitalraketen auf, eine je Rakete ([[abm|Abfangrakete]]).',
        ],
        [
          'Schutz',
          `Wer weniger als ${percent(1 / PROTECTION_RATIO)} der Punkte eines anderen hat, ist vor ihm geschützt; im Urlaubsmodus bist du vor allen geschützt ([[rule-protection]]).`,
        ],
      ]),
    ),
  ],
};
