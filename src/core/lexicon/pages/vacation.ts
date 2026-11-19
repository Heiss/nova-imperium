// The rule page „Urlaubsmodus“ (#288, #223): when it can start, what it
// stops and protects, and when it ends. The numbers come from
// `src/core/vacation.ts` and the round; the words are a draft of Claude for
// the owner to check ([V], #288).
import { HOUR_MS, vacationEnd } from '../../vacation.ts';
import { formulas, hours, say, section } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

const enterSection = (): PageSection =>
  section(
    'enter',
    'Starten',
    say(
      'Den Urlaubsmodus startest du in den Optionen. Das geht nur, wenn nichts mehr läuft: Keine eigene Flotte darf unterwegs sein, und auf keinem deiner Planeten und Monde darf ein Bauauftrag, eine Forschung oder ein Auftrag der Schiffsschmiede laufen oder warten.',
    ),
  );

const duringSection = (): PageSection =>
  section(
    'during',
    'Solange er läuft',
    say(
      'Deine Produktion ruht, und du kannst nichts tun, außer den Urlaubsmodus zu beenden und die Benachrichtigungen einzustellen: Das Spiel zeigt eine Sperrseite statt der Ansichten. Passwort, Passkeys und das Konto selbst kannst du weiter ändern. Alle deine Planeten und Monde sind vor neuen Aufträgen anderer Spieler geschützt ([[rule-protection]]).',
    ),
  );

const endSection = (s: LexState): PageSection =>
  section(
    'end',
    'Beenden',
    say(
      'Beenden kannst du den Urlaubsmodus erst, wenn seine Mindestdauer vorbei ist; sie läuft ab dem Start in echter Zeit und beträgt in dieser Runde {hours}. Der Admin legt sie für die Runde fest und kann sie während der Runde ändern. Eine neue Runde beendet den Urlaubsmodus von selbst.',
      { hours: hours(s.round.vacationHours) },
    ),
    formulas({
      text: 'Frühestes Ende = Start + Mindestdauer',
      fn: (start, h) => start! + h! * HOUR_MS,
      rule: vacationEnd,
      samples: [
        [0, 48],
        [1_800_000_000_000, 1],
        [5, 720],
      ],
    }),
  );

export const page: PageDef = {
  id: 'rule-vacation',
  kind: 'rule',
  title: 'Urlaubsmodus',
  line: 'Wie du das Spiel pausierst, was dann ruht und wann du zurückkehren kannst.',
  keywords: ['Urlaub', 'Pause', 'pausieren', 'abwesend'],
  seeAlso: ['rule-protection', 'rule-vision'],
  sections: (s) => [enterSection(), duringSection(), endSection(s)],
};
