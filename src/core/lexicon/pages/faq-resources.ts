// The question „Wie komme ich an mehr Rohstoffe?“ (#288): the sources of
// Adamant, Psikristall and Promethium that the rules give. The numbers come
// from the rules named in each line; the words are a draft of Claude for the
// owner to check ([V], #288).
import { rewardsOn } from '../../achievements.ts';
import { DEBRIS_SHARE } from '../../debris.ts';
import { LOOT_SHARE } from '../../loot.ts';
import { marketOpen, type MarketRound } from '../../market.ts';
import { facts, percent, say, section } from '../say.ts';
import type { PageDef } from '../types.ts';

const page: PageDef = {
  id: 'faq-resources',
  kind: 'question',
  title: 'Wie komme ich an mehr Rohstoffe?',
  line: 'Förderung ausbauen, Energie sichern, tauschen, bergen oder erbeuten.',
  keywords: ['Rohstoffe', 'Adamant', 'Psikristall', 'Promethium', 'mehr'],
  seeAlso: ['rule-production', 'rule-market', 'rule-debris', 'rule-rewards'],
  sections: (s) => [
    section(
      'answer',
      'Kurz gesagt',
      say(
        'Es gibt mehrere Wege: mehr fördern, tauschen, Trümmer bergen, erbeuten und Belohnungen abholen.',
      ),
      facts([
        [
          'Mehr fördern',
          'Baue die Förderstätten aus ([[metal]], [[crystal]], [[deut]]) und sorge für genug Energie und Lagerplatz. Mehr unter [[rule-production]].',
        ],
        // A switched-off feature has no row at all (owner, 2026-11-25,
        // 122a, #404).
        ...(marketOpen(s.round as unknown as MarketRound)
          ? ([
              [
                'Tauschen',
                'In dieser Runde gibt es den Marktplatz: Mit einem [[market|Handelsposten]] tauschst du die drei Rohstoffe gegeneinander ([[rule-market]]).',
              ],
            ] as [string, string][])
          : []),
        [
          'Bergen',
          `Nach Kämpfen liegen ${percent(DEBRIS_SHARE)} der zerstörten Schiffe als Trümmerfeld an der Position; eine Bergung sammelt es ein ([[rule-debris]]).`,
        ],
        [
          'Erbeuten',
          `Wer einen Planeten besiegt, nimmt bis zu ${percent(LOOT_SHARE)} jedes Rohstoffs mit, soweit der Laderaum reicht ([[rule-battle]]). Geschützte Spieler kannst du nicht angreifen ([[rule-protection]]).`,
        ],
        ...(rewardsOn(s.round)
          ? ([
              [
                'Belohnungen',
                `Die Tagesbelohnung und die Erfolge zahlen Rohstoffe aus ([[rule-rewards]]). Tagesbelohnung in dieser Runde: ${s.round.daily ? 'ja' : 'nein'}, Erfolge: ${s.round.achievements ? 'ja' : 'nein'}.`,
              ],
            ] as [string, string][])
          : []),
      ]),
      say('Dazu kommt, was jeder Planet ohne Gebäude von selbst fördert.'),
    ),
  ],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 310, page };
