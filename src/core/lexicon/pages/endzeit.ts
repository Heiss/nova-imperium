// The rule page „Endzeit“ (#288): the gift of the admin at the end of a round
// and what it raises. The numbers come from `src/core/endzeit.ts`, the
// catalog and the universe; the words are a draft of Claude for the owner to
// check ([V], #288).
import {
  GIFT_MINUTES,
  GIFT_RESOURCES,
  GIFT_SHIPS_EACH,
  giftLevels,
  standing,
} from '../../endzeit.ts';
import type { Levels } from '../../types.ts';
import { minutes, nameOf, number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** The levels the gift raises to, as rows: the entry with its level. */
const rows = (levels: Levels) =>
  Object.entries(levels)
    .filter(([, level]) => level > 0)
    .map(([key, level]) => [{ text: nameOf(key), link: key }, level]);

const giftSection = (s: LexState): PageSection =>
  section(
    'gift',
    'Die Gabe',
    say(
      'Am Ende einer Runde kann der Admin die Endzeit einläuten, und zwar einmal je Runde. Dann bekommt jeder Spieler mit einem Heimatplaneten eine Flotte, die von jedem Schiff, das fliegen kann, {ships} Stück enthält, und die von jedem Rohstoff {resources} als Ladung trägt. Die Flotte startet vom Heimatplaneten und fliegt zu ihm; auf dem Weg lässt sie sich nicht zurückrufen, und sie belegt keinen Flottenslot. In diesem Universum ist die Flugzeit der Gabe zunächst auf {time} eingestellt; der Admin kann sie beim Einläuten ändern, aber nur auf {low} bis {high} Minuten.',
      {
        ships: number(GIFT_SHIPS_EACH),
        resources: number(GIFT_RESOURCES),
        time: minutes(s.u.endzeitMinutes),
        low: number(GIFT_MINUTES.min),
        high: number(GIFT_MINUTES.max),
      },
    ),
    say(
      'Die Ladung kommt auf dem Heimatplaneten an, auch über das Lager hinaus. Die Schiffe zählen für die Punkte der Highscore vom Start an wie jede Flotte, Gebäude und Forschung ab der Ankunft. Der Noobschutz bleibt wie er ist.',
    ),
  );

const levelsSection = (): PageSection =>
  section(
    'levels',
    'Was bei der Ankunft angehoben wird',
    say(
      'Bei der Ankunft werden die Forschung und die Gebäude des Heimatplaneten auf die Stufen angehoben, die alle Voraussetzungen im Spiel zusammen verlangen, dazu auf ein paar Mindeststufen. Höhere Stufen bleiben, und nichts wird weggenommen. Die Gebäude dürfen dabei mehr Felder brauchen, als der Planet hat, und es werden nur Gebäude angehoben, die auf einem Planeten stehen dürfen. Ein Bau oder eine Forschung, die damit überholt ist, wird abgebrochen und erstattet.',
    ),
    table(
      'Gebäude des Heimatplaneten',
      ['Gebäude', 'Stufe'],
      rows(standing(giftLevels().b, 'planet')),
    ),
    table('Forschung', ['Forschung', 'Stufe'], rows(giftLevels().r)),
  );

export const page: PageDef = {
  id: 'rule-endzeit',
  kind: 'rule',
  title: 'Endzeit',
  line: 'Das Geschenk am Ende einer Runde: eine Flotte aus allem, was fliegt, und die Stufen, die dafür nötig sind.',
  keywords: ['Geschenk', 'Rundenende', 'Gabe', 'Gottkaiser'],
  seeAlso: ['rule-universe', 'mission-deploy'],
  sections: (s) => [giftSection(s), levelsSection()],
};
