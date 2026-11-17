// What the search of the Lexicanum reads of every article (#285, B6): the
// title, the abbreviation, the keywords and the text as it reads: the short
// and long texts of the catalog, the texts of its lexicon part and the
// headings it shows. The text of a mission is also the line below its hit. It does not depend on the player's state.
import { ARTICLES, type ArticleMeta, titleOf } from './articles.ts';
import { fill, plain } from './links.ts';
import type { SearchDoc } from './search.ts';

/** The headings of an article (the texts of the study of #285, [V]). */
export const HEADINGS = {
  effect: 'Was die Stufen bringen',
  levels: 'Stufen',
  req: 'Voraussetzungen',
  used: 'Wird gebraucht für',
  see: 'Siehe auch',
} as const;

/** The texts of the lexicon part of an entry with their values, as they read. */
export const partTexts = (a: ArticleMeta): string[] =>
  (a.lexicon.texts ?? []).map((t) => plain(fill(t.text, t.values), titleOf));

/** Whether an article has the section „Was die Stufen bringen“. */
export const hasEffect = (a: ArticleMeta): boolean =>
  a.kind !== 'mission' &&
  !!(
    a.lexicon.texts ||
    a.lexicon.formulas ||
    a.lexicon.blocks ||
    a.lexicon.effect
  );

function doc(a: ArticleMeta): SearchDoc {
  const d: SearchDoc = {
    id: a.id,
    kind: a.kind,
    title: a.title,
    keywords: a.lexicon.keywords ?? [],
    text: [
      a.ds ?? '',
      a.lt ?? '',
      ...partTexts(a),
      ...(hasEffect(a) ? [HEADINGS.effect] : []),
    ].join(' '),
    line: a.ds ?? partTexts(a).join(' '),
  };
  if (a.ab) d.ab = a.ab;
  return d;
}

/** The documents of all articles, in their order. */
export const searchDocs = (): SearchDoc[] => ARTICLES.map(doc);
