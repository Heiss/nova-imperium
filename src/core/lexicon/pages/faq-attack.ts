// The question „Warum kann ich diesen Spieler nicht angreifen?“ (#288): the
// reasons the server refuses an attack, with the player's own points. The
// numbers come from `src/core/protection.ts` and the missions; the words are
// a draft of Claude for the owner to check ([V], #288).
import { fleetSlots } from '../../flight.ts';
import { PROTECTION_RATIO, unprotectedFrom } from '../../protection.ts';
import { count, facts, number, percent, say, section } from '../say.ts';
import type { Block, PageDef } from '../types.ts';

const page: PageDef = {
  id: 'faq-attack',
  kind: 'question',
  title: 'Warum kann ich diesen Spieler nicht angreifen?',
  line: 'Meist schützt ihn sein geringer Punktestand oder der Urlaubsmodus; es kann auch an Slots oder am Ziel liegen.',
  keywords: ['angreifen', 'geschützt', 'Noobschutz', 'Urlaub', 'verweigert'],
  seeAlso: ['rule-protection', 'rule-vacation', 'mission-attack', 'faq-slots'],
  sections: (s) => [
    section(
      'answer',
      'Kurz gesagt',
      say(
        'Der Spieler ist geschützt, oder dein Auftrag passt nicht zum Ziel. Das Spiel nennt den Grund, wenn du den Auftrag startest. Diese Gründe gibt es:',
      ),
      facts([
        [
          'Noobschutz',
          `Er hat weniger als ${percent(1 / PROTECTION_RATIO)} deiner Punkte. Dann kannst du ihn nicht angreifen und nicht erkunden; auf der Sternenkarte steht bei ihm (n). Mehr unter [[rule-protection]].`,
        ],
        [
          'Urlaubsmodus',
          'Er ist im [[rule-vacation|Urlaubsmodus]]. Dann ist jeder seiner Planeten und Monde vor allen Aufträgen anderer Spieler geschützt.',
        ],
        [
          'Eigener Planet',
          'Eigene Planeten kannst du nicht angreifen. Der Auftrag Verlegung bringt Schiffe zu einem eigenen Planeten.',
        ],
        [
          'Kein Ziel',
          'An der Position steht kein Planet, oder du hast keine Schiffe gewählt. Eine freie Position lässt sich besiedeln oder vermessen, aber nicht angreifen.',
        ],
        [
          'Keine freie Flotte',
          `Alle deine Flottenslots sind belegt; mit ${count(fleetSlots({ research: s.research }), 'Slot', 'Slots')} kannst du so viele Flotten gleichzeitig schicken. Mehr unter [[faq-slots|Flottenslots]].`,
        ],
      ]),
      ...personal(s.own?.points.own),
    ),
  ],
};

/** „Dein Stand“: whom the own points protect. */
function personal(own: number | undefined): Block[] {
  if (own === undefined) return [];
  return [
    {
      t: 'stand',
      text: `Dein Stand: Du hast ${number(own)} Punkte. Spieler mit weniger als ${number(unprotectedFrom(own))} Punkten sind vor dir geschützt.`,
    },
  ];
}

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 260, page };
