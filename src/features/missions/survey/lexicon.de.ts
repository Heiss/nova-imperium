// What the article of the mission „Vermessung“ adds in the Lexicanum (#190,
// #285): what happens on arrival, from its rules and its arrival
// (arrive.server.ts), and the everyday words that find it in the search
// ([V], okf/features/lexicanum-texts.md). The days come from the rules.
import { number } from '../../../core/lexicon/parts.ts';
import type { EntryLexicon } from '../../../core/lexicon/types.ts';
import { SURVEY_DAYS } from '../../../core/survey.ts';

export const lexicon: EntryLexicon = {
  keywords: ['vermessen', 'Position', 'Planet', 'Kolonie'],
  texts: [
    {
      text: 'Am Ziel vermessen die [[probe]] die freie Position und bringen einen Vermessungsbericht. Je mehr Spähschädel du schickst und je höher deine [[carto]] steht, desto mehr steht darin; reicht es nicht, bleibt es bei einem groben Text, der nur sagt, was sich von der Position erraten lässt. Die Spähschädel können dabei verloren gehen, und je weiter der Flug, desto eher: Dann gibt es keinen Bericht, und die Position bekommt keine Werte. Sonst fliegen sie heim. Die Position behält die gemessenen Werte {days} Tage ab der ersten Vermessung; wird sie in dieser Zeit besiedelt, bekommt die Kolonie genau diese Werte.',
      values: { days: number(SURVEY_DAYS) },
    },
  ],
};
