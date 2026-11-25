// What the search reads of an article (#285, B6), on articles made for the
// test: every real entry has a short text, a long text and keywords, so
// only a made one shows what a missing part does.
import { describe, expect, it } from 'vitest';
import { ARTICLES, type ArticleMeta } from './articles.ts';
import {
  firstSentence,
  hasEffect,
  HEADINGS,
  pageParts,
  partTexts,
  searchDoc,
  searchDocs,
} from './docs.ts';
import { defaultState } from './state.ts';
import { fast, HOSTILE, sameOn } from '../../test/redos.ts';
import type { Block, EntryLexicon, LexState, PageDef } from './types.ts';

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

/** A page made for the test: the blocks it shows depend on the state's ships. */
const made = (blocks: (s: LexState) => Block[], o: Partial<PageDef> = {}) =>
  ({
    id: 'rule-made',
    kind: 'rule',
    title: 'Gemacht',
    line: 'Die Zeile.',
    keywords: [],
    sections: (s) => [{ id: 'a', title: 'Erster', blocks: blocks(s) }],
    ...o,
  }) satisfies PageDef;

describe('the words of a page', () => {
  it('start with its line, then each heading with the words of its blocks', () => {
    const page = made(() => [
      { t: 'text', text: 'Siehe [[spy]] ab {n}.', values: { n: '3' } },
      { t: 'formula', lines: ['a = b', 'c = d'] },
      { t: 'stand', text: 'Dein Stand: 4' },
      { t: 'links', items: [{ id: 'spy' }] },
    ]);
    expect(pageParts(page, defaultState())).toEqual([
      { label: 'Line', text: 'Die Zeile.' },
      { label: 'Heading', text: 'Erster' },
      { label: 'Text', text: 'Siehe Auspex-Lehre ab 3.' },
      { label: 'Formula', text: 'a = b' },
      { label: 'Formula', text: 'c = d' },
      { label: 'Stand', text: 'Dein Stand: 4' },
    ]);
  });

  it('name the caption and the head of a table, the head joined by bars', () => {
    const rows = [{ cells: ['x', 'y'] }];
    const page = made(() => [
      { t: 'table', caption: 'Unterschrift', head: ['A', 'B'], rows },
      { t: 'table', head: ['C'], rows },
    ]);
    expect(pageParts(page, defaultState()).slice(2)).toEqual([
      { label: 'Table', text: 'Unterschrift' },
      { label: 'Table', text: 'A | B' },
      { label: 'Table', text: 'C' },
    ]);
  });

  it('give each fact as „label: text“ and each chip as „label text“', () => {
    const page = made(() => [
      {
        t: 'facts',
        items: [
          { label: 'Schritt 1', text: 'Erforsche [[spy]].' },
          { label: 'Ziel', text: 'Mond' },
        ],
      },
      { t: 'chips', items: [{ label: 'Preis', text: '5 Adamant' }] },
    ]);
    expect(pageParts(page, defaultState()).slice(2)).toEqual([
      { label: 'Facts', text: 'Schritt 1: Erforsche Auspex-Lehre.' },
      { label: 'Facts', text: 'Ziel: Mond' },
      { label: 'Facts', text: 'Preis 5 Adamant' },
    ]);
  });

  it('are those of the state given', () => {
    const page = made((s) => [{ t: 'stand', text: `Schiffe: ${s.ships.sc}` }]);
    const state = { ...defaultState(), ships: { sc: 7 } };
    expect(pageParts(page, state).at(-1)).toEqual({
      label: 'Stand',
      text: 'Schiffe: 7',
    });
  });

  it('are those of the default state for a page without review states', () => {
    const page = made((s) => [{ t: 'stand', text: `Schiffe: ${s.ships.sc}` }]);
    expect(pageParts(page).at(-1)).toEqual({
      label: 'Stand',
      text: 'Schiffe: undefined',
    });
  });

  it('are those of the first review state, then what each next one adds', () => {
    const ships = (sc: number): LexState => ({
      ...defaultState(),
      ships: { sc },
    });
    const page = made(
      (s) => [
        { t: 'stand', text: `Schiffe: ${s.ships.sc}` },
        { t: 'stand', text: 'Immer' },
        { t: 'text', text: `Schiffe: ${s.ships.sc}` },
      ],
      { review: [ships(1), ships(2), ships(1)] },
    );
    expect(pageParts(page)).toEqual([
      { label: 'Line', text: 'Die Zeile.' },
      { label: 'Heading', text: 'Erster' },
      { label: 'Stand', text: 'Schiffe: 1' },
      { label: 'Stand', text: 'Immer' },
      { label: 'Text', text: 'Schiffe: 1' },
      // The second state adds what differs; a part with the same label and
      // text is not shown twice, a part with the same text but another label is.
      { label: 'Stand', text: 'Schiffe: 2' },
      { label: 'Text', text: 'Schiffe: 2' },
    ]);
  });

  it("are the default state's for an empty list of review states", () => {
    const page = made(() => [{ t: 'stand', text: 'Ein Wort' }], { review: [] });
    expect(pageParts(page)).toEqual([
      { label: 'Line', text: 'Die Zeile.' },
      { label: 'Heading', text: 'Erster' },
      { label: 'Stand', text: 'Ein Wort' },
    ]);
  });

  it('leave a text with the same words but another label in', () => {
    const page = made(
      (s) =>
        s.ships.sc === 1
          ? [{ t: 'text', text: 'Gleich' }]
          : [{ t: 'stand', text: 'Gleich' }],
      {
        review: [
          { ...defaultState(), ships: { sc: 1 } },
          { ...defaultState(), ships: { sc: 2 } },
        ],
      },
    );
    expect(pageParts(page).slice(2)).toEqual([
      { label: 'Text', text: 'Gleich' },
      { label: 'Stand', text: 'Gleich' },
    ]);
  });
});

describe('the texts of a written page as they read', () => {
  it('are the words of the page, in the review state', () => {
    const page = made(() => [{ t: 'stand', text: 'Ein Wort' }]);
    expect(partTexts(meta({ page }))).toEqual([
      'Die Zeile.',
      'Erster',
      'Ein Wort',
    ]);
  });
});

describe('the first sentence in linear time (#367)', () => {
  it('is the one the unanchored expression found', () => {
    const OLD = /.*?[.!?](?=\s)/s;
    sameOn(['a', '.', '!', '?', ' ', '\n', '5'], (text) => {
      expect(firstSentence(text)).toBe(OLD.exec(text)?.[0] ?? text);
    });
  });

  it('reads a text of marks without a space fast (before: about 5 s)', () => {
    const text = '.'.repeat(HOSTILE);
    expect(fast(() => firstSentence(text))).toBe(text);
  });
});
