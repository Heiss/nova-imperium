// What the article of the mission „Mondbruch“ adds in the Lexicanum
// (#285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md).
import type { EntryLexicon } from '../../../core/lexicon/types.ts';

export const lexicon: EntryLexicon = {
  keywords: ['Mond', 'vernichten', 'sprengen', 'brechen'],
  texts: [
    {
      text: 'Am Ziel, dem Mond eines anderen Spielers, kämpft die Flotte wie beim Sturmangriff gegen die Schiffe und die Verteidigung des Mondes; die anderen Schiffe fliegen mit und kämpfen mit. Nur nach einem gewonnenen Kampf oder gegen einen unverteidigten Mond, und nur mit [[dstar|Weltenbrechern]], die den Kampf überstanden haben, folgen zwei voneinander unabhängige Würfe: ob der Mond zerbricht und ob die Weltenbrecher vom eigenen Schuss zerrissen werden. Je größer der Mond, desto seltener zerbricht er und desto eher gehen die Weltenbrecher verloren; je mehr Weltenbrecher, desto eher zerbricht er. Ein zerbrochener Mond ist mit allem, was auf ihm war, verloren und hinterlässt kein Trümmerfeld; Flotten, die ihn anfliegen, landen auf seinem Planeten. Die Beute wird auf den Laderaum der Schiffe gekürzt, die übrig sind. Beide Seiten erhalten einen Kampfbericht.',
    },
  ],
};
