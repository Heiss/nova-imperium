// The rule page „Fair spielen“ (#181; owner, 2026-11-21, D5): a general rule
// that the game must not be played by an AI or a program, and that the
// Spielleitung can check it. No player is told when the check is switched on
// for them. The words are a draft of Claude for the owner to check ([V]).
import { say, section } from '../say.ts';
import type { PageDef, PageSection } from '../types.ts';

const ruleSection = (): PageSection =>
  section(
    'automation',
    'Selbst spielen',
    say(
      'Das Spiel darf nicht von einer KI oder einem Programm bedient werden: Jede Aktion kommt von dir. Die Spielleitung kann das für einzelne Spieler prüfen.',
    ),
  );

export const page: PageDef = {
  id: 'rule-fair',
  kind: 'rule',
  title: 'Fair spielen',
  line: 'Wer das Spiel bedienen darf.',
  keywords: ['KI', 'Bot', 'Programm', 'Automatisierung', 'Regeln'],
  seeAlso: ['rule-universe'],
  sections: () => [ruleSection()],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 240, page };
