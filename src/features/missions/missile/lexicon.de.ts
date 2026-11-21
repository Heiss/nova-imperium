// What the article of the mission „Raketenangriff“ adds in the Lexicanum
// (#285, #54): what happens on arrival, from its rules and its arrival
// (arrive.server.ts, src/core/missiles.ts), and the everyday words that find
// it in the search ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Raketen', 'beschießen', 'Fernangriff', 'Verteidigung'],
  seeAlso: ['rule-missiles'],
  texts: [
    {
      text: 'Am Ziel hält jede [[abm]] des Verteidigers eine anfliegende [[ipm]] auf. Die übrigen treffen nur Verteidigung, die kämpft: zuerst das Hauptziel, dann alles andere der Reihe nach; Schilde zählen dabei nicht. Ist keine Verteidigung mehr übrig, zerstört der Rest der Wucht die gelagerten Raketen der [[silo]]. Zerstörte Verteidigung wird nicht wieder aufgebaut und hinterlässt kein Trümmerfeld. Ist das Ziel inzwischen verschwunden, sind die Raketen verloren; beide Seiten erhalten einen Bericht.',
    },
  ],
};
