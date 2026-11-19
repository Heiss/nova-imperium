// The guide „Deine erste Kolonie“ (#289): why, and the steps from the ship to
// the first buildings. The numbers come from the catalog and the rules of the
// round; the words are a draft of Claude for the owner to check ([V], #289,
// D1 and D3 as recommended).
import { colonyRules, limitLine } from '../../colony-limit.ts';
import { requires, say, section, steps } from '../say.ts';
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

const whySection = (): PageSection =>
  section(
    'why',
    'Wozu eine Kolonie',
    say(
      'Eine Kolonie ist ein weiterer Planet. Sie hat eigene Felder für Gebäude, fördert eigene Rohstoffe und hat ein eigenes Lager. Deine Forschung und deine Flottenslots gelten für alle Planeten zusammen. Wie viele Planeten du haben darfst, kann der Admin für die Runde begrenzen ([[rule-colonies]]).',
    ),
  );

const stepsSection = (s: LexState): PageSection => {
  const stand: Block[] = s.own
    ? [
        {
          t: 'stand',
          text: `Dein Stand: ${limitLine(colonyRules(s.u), s.own.planets, s.research.colonial ?? 0)}`,
        },
      ]
    : [];
  return section(
    'steps',
    'Von der Arche zur Kolonie',
    steps(
      'Prüfe die Planetengrenze dieser Runde und gib, wenn sie erreicht ist, eine Kolonie auf oder erforsche, was sie hebt ([[rule-colonies]]).',
      `Baue eine [[colony|Kolonistenarche]] in der [[yard|Orbitalen Schiffsschmiede]]. Sie braucht ${requires('colony')}.`,
      'Suche auf der Sternenkarte eine freie Position. Wie viele Felder die Kolonie bekommt und wie warm sie wird, hängt von der Position ab ([[rule-planets]]); eine [[mission-survey|Vermessung]] mit Spähschädeln zeigt es vorher.',
      'Schicke die Arche mit der [[mission-colonize|Landnahme]] zu dieser Position. Wie lange der Flug dauert und was er an Promethium kostet, nennt das Flottenformular ([[rule-flight]]).',
      'Gib der Kolonie Förderstätten und Energie wie dem Heimatplaneten, und baue ihre Lager aus, wenn sie voll werden ([[guide-start]]).',
    ),
    ...stand,
  );
};

export const page: PageDef = {
  id: 'guide-colony',
  kind: 'guide',
  title: 'Deine erste Kolonie',
  line: 'Von der Kolonistenarche bis zu den ersten Gebäuden der neuen Kolonie.',
  keywords: ['Kolonie', 'Planet', 'besiedeln', 'erweitern', 'Arche'],
  seeAlso: ['faq-colony', 'rule-colonies', 'colony', 'mission-colonize'],
  sections: (s) => [whySection(), stepsSection(s)],
};
