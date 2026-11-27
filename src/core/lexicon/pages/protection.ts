// The rule page „Schutz der Schwachen“ (#288): the noob protection and the
// protection of a player in vacation mode. The numbers come from
// `src/core/protection.ts` and the missions; the words are a draft of Claude
// for the owner to check ([V], #288).
import {
  isProtected,
  PROTECTION_RATIO,
  unprotectedFrom,
} from '../../protection.ts';
import { HOLD_LEXICON } from '../../hold-texts.ts';
import { formulas, number, percent, say, section, table } from '../say.ts';
import type { PageDef, PageSection } from '../types.ts';

const POINTS = [100, 1000, 5000, 20000, 100000];

const noobSection = (): PageSection =>
  section(
    'noob',
    'Noobschutz',
    say(
      'Wer viel weniger Punkte hat als du, ist vor dir geschützt: Du kannst ihn nicht angreifen und nicht erkunden, ihn nicht mit einem Mondbruch oder Raketen treffen. Als geschützt gilt, wer weniger als {share} deiner Punkte hat. Es zählen die Punkte der Gesamtwertung ([[rule-highscore]]). Der Schutz gilt nur gegen Stärkere: Ein Spieler mit wenig Punkten darf einen mit vielen angreifen. Versorgungsflüge sind nicht betroffen. Auf der Sternenkarte sind geschützte Spieler mit (n) markiert.',
      { share: percent(1 / PROTECTION_RATIO) },
    ),
    // Where a foreign fleet holds, the protection lapses for attacks and
    // espionage (#440, 238c, 281b): the words are the owner's.
    say(HOLD_LEXICON.lapsedProtection),
    formulas({
      text: 'Geschützt, wenn Punkte des Ziels · {ratio} < deine Punkte',
      values: { ratio: number(PROTECTION_RATIO) },
      fn: (mine, theirs) => (theirs! * PROTECTION_RATIO < mine! ? 1 : 0),
      rule: (mine, theirs) => (isProtected(mine!, theirs!) ? 1 : 0),
      samples: [
        [1000, 199],
        [1000, 200],
        [1000, 201],
        [5, 0],
        [0, 0],
      ],
    }),
    table(
      'Wer vor dir geschützt ist',
      ['Deine Punkte', 'Geschützt sind Spieler mit weniger Punkten als'],
      POINTS.map((mine) => [mine, unprotectedFrom(mine)]),
    ),
    say(
      'Der Noobschutz gilt für die Aufträge [[mission-attack]], [[mission-spy]], [[mission-moonbreak]] und [[mission-missile]].',
    ),
  );

const vacationSection = (): PageSection =>
  section(
    'vacation',
    'Urlaubsmodus',
    say(
      'Ein Spieler im [[rule-vacation|Urlaubsmodus]] ist vor allen neuen Aufträgen anderer Spieler geschützt, ganz gleich, wie viele Punkte er hat, und auch vor Versorgungsflügen und Raketen. Seine Planeten und Monde bleiben so lange unberührt, bis er den Urlaubsmodus beendet.',
    ),
  );

const page: PageDef = {
  id: 'rule-protection',
  kind: 'rule',
  title: 'Schutz der Schwachen',
  line: 'Wer vor wem geschützt ist: der Noobschutz und der Schutz im Urlaubsmodus.',
  keywords: ['Noobschutz', 'geschützt', 'Schutz', 'angreifen', 'Punkte'],
  seeAlso: [
    'faq-attack',
    'rule-vacation',
    'mission-attack',
    'mission-spy',
    'rule-highscore',
  ],
  sections: () => [noobSection(), vacationSection()],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 150, page };
