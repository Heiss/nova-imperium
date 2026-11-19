// The question „Wie gründe ich eine Kolonie?“ (#288): the steps, the limit of
// planets and the player's own count. The numbers come from the catalog and
// `src/core/colony-limit.ts`; the words are a draft of Claude for the owner
// to check ([V], #288).
import { colonyRules, limitLine } from '../../colony-limit.ts';
import { requires, say, section, steps } from '../say.ts';
import type { Block, PageDef } from '../types.ts';

export const page: PageDef = {
  id: 'faq-colony',
  kind: 'question',
  title: 'Wie gründe ich eine Kolonie?',
  line: 'Mit einer Kolonistenarche, die du zu einer freien Position schickst.',
  keywords: ['Kolonie', 'gründen', 'besiedeln', 'neuer', 'Planet'],
  seeAlso: ['rule-colonies', 'colony', 'mission-colonize', 'mission-survey'],
  sections: (s) => {
    const rules = colonyRules(s.u);
    const stand: Block[] = s.own
      ? [
          {
            t: 'stand',
            text: `Dein Stand: ${limitLine(rules, s.own.planets, s.research.colonial ?? 0)}`,
          },
        ]
      : [];
    return [
      section(
        'answer',
        'Kurz gesagt',
        say(
          'Baue eine [[colony|Kolonistenarche]] und schicke sie mit dem Auftrag [[mission-colonize]] zu einer freien Position. Bleibt sie dort frei, entsteht die Kolonie, und die Arche bleibt in ihr.',
        ),
      ),
      section(
        'steps',
        'Schritte',
        steps(
          `Baue eine Kolonistenarche in der [[yard|Orbitalen Schiffsschmiede]]. Sie braucht ${requires('colony')}.`,
          'Suche auf der Sternenkarte eine freie Position. Eine Vermessung mit Spähschädeln ([[mission-survey]]) zeigt vorher, wie groß und wie warm der Planet wird.',
          'Prüfe die Planetengrenze: In manchen Runden darf ein Spieler nur eine bestimmte Zahl von Planeten haben ([[rule-colonies]]).',
          'Schicke die Kolonistenarche mit der Landnahme zu dieser Position; Rohstoffe, die du mitgibst, werden der erste Vorrat der Kolonie.',
        ),
        ...stand,
      ),
    ];
  },
};
