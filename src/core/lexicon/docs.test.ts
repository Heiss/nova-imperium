// What the search reads of an article (#285, B6), on articles made for the
// test: every real entry has a short text, a long text and keywords, so
// only a made one shows what a missing part does.
import { describe, expect, it } from 'vitest';
import { ARTICLES, type ArticleMeta } from './articles.ts';
import {
  firstSentence,
  hasEffect,
  HEADINGS,
  partTexts,
  searchDoc,
  searchDocs,
} from './docs.ts';
import type { EntryLexicon } from './types.ts';

const meta = (o: Partial<ArticleMeta> = {}): ArticleMeta => ({
  id: 'thing',
  kind: 'building',
  title: 'Ding',
  key: 'thing',
  lexicon: {},
  ...o,
});

const FORMULA = {
  text: 'a = b',
  fn: (x: number) => x,
  rule: (x: number) => x,
  samples: [[1]],
};

describe('the first sentence of a text', () => {
  it('ends at the first full stop, „!“ or „?“ that a space follows', () => {
    expect(firstSentence('Eins. Zwei. Drei.')).toBe('Eins.');
    expect(firstSentence('Halt! Weiter.')).toBe('Halt!');
    expect(firstSentence('Wer da? Niemand.')).toBe('Wer da?');
    expect(firstSentence('Erst: (siehe dort). Dann mehr.')).toBe(
      'Erst: (siehe dort).',
    );
  });

  it('does not end at a mark inside a number or a word', () => {
    expect(firstSentence('Bis 5.000 Stück. Mehr nicht.')).toBe(
      'Bis 5.000 Stück.',
    );
    expect(firstSentence('Rund 3,2-mal so viel.\nNeue Zeile.')).toBe(
      'Rund 3,2-mal so viel.',
    );
  });

  it('is the whole text when no sentence ends before its end', () => {
    expect(firstSentence('Nur ein Satz.')).toBe('Nur ein Satz.');
    expect(firstSentence('Ohne Punkt')).toBe('Ohne Punkt');
    expect(firstSentence('Zwei\nZeilen ohne Punkt')).toBe(
      'Zwei\nZeilen ohne Punkt',
    );
    expect(firstSentence('')).toBe('');
  });
});

describe('the section „Was die Stufen bringen“', () => {
  it('is there for each part alone: a text, a formula, a block, an effect', () => {
    const parts: EntryLexicon[] = [
      { texts: [{ text: 'Ein Text.' }] },
      { formulas: [FORMULA] },
      { blocks: () => [] },
      { effect: { label: 'Wert', at: (level) => level } },
    ];
    for (const lexicon of parts)
      expect(hasEffect(meta({ lexicon }))).toBe(true);
  });

  it('is missing without any of them, and for keywords alone', () => {
    expect(hasEffect(meta())).toBe(false);
    expect(hasEffect(meta({ lexicon: { keywords: ['Wort'] } }))).toBe(false);
    expect(hasEffect(meta({ lexicon: { seeAlso: ['spy'] } }))).toBe(false);
  });

  it('is never there for a mission, whatever its part holds', () => {
    const lexicon: EntryLexicon = {
      texts: [{ text: 'Am Ziel.' }],
      formulas: [FORMULA],
      blocks: () => [],
      effect: { label: 'Wert', at: (level) => level },
    };
    expect(hasEffect(meta({ kind: 'mission', lexicon }))).toBe(false);
    expect(hasEffect(meta({ kind: 'research', lexicon }))).toBe(true);
  });
});

describe('the texts of a lexicon part as they read', () => {
  it('fills the values and shows the title of a link', () => {
    const a = meta({
      lexicon: {
        texts: [
          { text: 'Siehe [[spy]] ab {n}.', values: { n: '3' } },
          { text: 'Zweiter [[probe|Text]].' },
        ],
      },
    });
    expect(partTexts(a)).toEqual(['Siehe Auspex-Lehre ab 3.', 'Zweiter Text.']);
    expect(partTexts(meta())).toEqual([]);
  });
});

describe('the search document of an article', () => {
  it('is empty but for its names when the article has nothing else', () => {
    // No `ab` key, no keyword, no text and no line.
    expect(searchDoc(meta())).toEqual({
      id: 'thing',
      kind: 'building',
      title: 'Ding',
      keywords: [],
      text: '',
      line: '',
    });
  });

  it('joins what the article has by one space, in the order it reads', () => {
    const full = meta({
      ab: 'DG',
      ds: 'Kurz.',
      lt: 'Lang und breit.',
      lexicon: {
        keywords: ['Wort', 'Sache'],
        texts: [
          { text: 'Erster Satz. Zweiter Satz.' },
          { text: 'Noch einer.' },
        ],
      },
    });
    expect(searchDoc(full)).toEqual({
      id: 'thing',
      kind: 'building',
      title: 'Ding',
      ab: 'DG',
      keywords: ['Wort', 'Sache'],
      text: `Kurz. Lang und breit. Erster Satz. Zweiter Satz. Noch einer. ${HEADINGS.effect}`,
      // An entry shows its short text below the hit.
      line: 'Kurz.',
    });
  });

  it('leaves out each part that is missing, without a gap', () => {
    expect(searchDoc(meta({ ds: 'Kurz.' })).text).toBe('Kurz.');
    expect(searchDoc(meta({ lt: 'Lang.' })).text).toBe('Lang.');
    expect(searchDoc(meta({ ds: 'Kurz.', lt: 'Lang.' })).text).toBe(
      'Kurz. Lang.',
    );
    const effect = meta({
      lt: 'Lang.',
      lexicon: { effect: { label: 'Wert', at: (level) => level } },
    });
    expect(searchDoc(effect).text).toBe(`Lang. ${HEADINGS.effect}`);
    expect(searchDoc(effect).line).toBe('');
    expect(searchDoc(meta({ ab: '' }))).not.toHaveProperty('ab');
    expect(searchDoc(meta({ ab: 'X' })).ab).toBe('X');
  });

  it('shows the first sentence of a mission below its hit, not its heading', () => {
    const mission = meta({
      id: 'mission-go',
      kind: 'mission',
      title: 'Flug',
      lexicon: {
        keywords: ['fliegen'],
        texts: [{ text: 'Am Ziel bleibt die [[spy]]. Dann fliegt sie heim.' }],
      },
    });
    expect(searchDoc(mission)).toEqual({
      id: 'mission-go',
      kind: 'mission',
      title: 'Flug',
      keywords: ['fliegen'],
      text: 'Am Ziel bleibt die Auspex-Lehre. Dann fliegt sie heim.',
      line: 'Am Ziel bleibt die Auspex-Lehre.',
    });
  });

  it('reads the texts as one, so a sentence may end in the next text', () => {
    const open = meta({
      kind: 'mission',
      lexicon: {
        texts: [{ text: 'Ohne Ende' }, { text: 'geht es weiter. Schluss.' }],
      },
    });
    expect(searchDoc(open).line).toBe('Ohne Ende geht es weiter.');
  });

  it('is built for every article, in their order', () => {
    expect(searchDocs()).toEqual(ARTICLES.map(searchDoc));
    const robot = ARTICLES.find((a) => a.id === 'robot')!;
    expect(searchDoc(robot)).toEqual({
      id: 'robot',
      kind: 'building',
      title: robot.title,
      ab: robot.ab,
      keywords: robot.lexicon.keywords,
      text: `${robot.ds} ${robot.lt}`,
      line: robot.ds,
    });
  });
});
