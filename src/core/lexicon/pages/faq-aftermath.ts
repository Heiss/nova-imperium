// The question „Was bleibt nach einer Schlacht übrig?“ (#288): the
// survivors, the Trümmerfeld, the rebuilt defense, the loot and the moon. The
// numbers come from `src/core/battle.ts`, `debris.ts`, `loot.ts` and
// the round (#433); the words are a draft of Claude for the owner to check ([V],
// #288).
import { MAX_ROUNDS } from '../../battle.ts';
import { DEBRIS_SHARE } from '../../debris.ts';
import { LOOT_SHARE, REBUILD_SHARE } from '../../loot.ts';
import { facts, number, percent, say, section } from '../say.ts';
import type { PageDef } from '../types.ts';

const page: PageDef = {
  id: 'faq-aftermath',
  kind: 'question',
  title: 'Was bleibt nach einer Schlacht übrig?',
  line: 'Die Überlebenden, ein Trümmerfeld, ein Teil der Verteidigung und die Beute des Siegers.',
  keywords: ['Schlacht', 'Verluste', 'Überlebende', 'Beute', 'übrig'],
  seeAlso: ['rule-battle', 'rule-debris', 'rule-moons', 'mission-attack'],
  sections: ({ round }) => [
    section(
      'answer',
      'Kurz gesagt',
      say(
        'Was den Kampf überlebt, bleibt: Der Angreifer fliegt mit den Überlebenden heim, der Verteidiger behält seine Überlebenden und einen Teil der zerstörten Verteidigung. Zerstörte Schiffe sind verloren, hinterlassen aber ein Trümmerfeld, und der Sieger kann Rohstoffe erbeuten. Beide Seiten bekommen einen Kampfbericht.',
      ),
      facts([
        [
          'Überlebende',
          `Der Kampf dauert höchstens ${number(MAX_ROUNDS)} Runden; wer dann noch Einheiten hat, behält sie. Mehr unter [[rule-battle]].`,
        ],
        [
          'Verteidigung',
          `${percent(REBUILD_SHARE)} der zerstörten Verteidigung wird wieder aufgebaut. Schiffe werden nie ersetzt, und Raketen kämpfen nicht mit.`,
        ],
        [
          'Trümmerfeld',
          `${percent(DEBRIS_SHARE)} des Adamants und Psikristalls aller zerstörten Schiffe liegen an der Position und lassen sich mit einer Bergung einsammeln ([[rule-debris]]).`,
        ],
        [
          'Beute',
          `Gewinnt der Angreifer, nimmt er bis zu ${percent(LOOT_SHARE)} jedes Rohstoffs des Planeten mit, soweit sein Laderaum reicht.`,
        ],
        [
          'Mond',
          `Aus dem Trümmerfeld kann ein Mond entstehen, mit höchstens ${number(round.moonChanceMax)} % Chance ([[rule-moons|Monde]]).`,
        ],
      ]),
    ),
  ],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 280, page };
