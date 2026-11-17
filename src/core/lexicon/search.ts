// The search of the Lexicanum (#285, B6): in the browser, without a request
// to the server, over the titles, the abbreviations, the text of the
// articles and their keywords in everyday words, which are not shown. Every
// word of the query must be found; the results are grouped by kind.
import type { ArticleKind } from './types.ts';

/** What the search reads of one article. */
export interface SearchDoc {
  id: string;
  kind: ArticleKind;
  title: string;
  ab?: string;
  keywords: readonly string[];
  /** The text of the article as it reads, headings included. */
  text: string;
  /** The line shown below a hit: the short text, or nothing. */
  line: string;
}

/** A hit of the search. */
export interface Hit {
  id: string;
  title: string;
  ab?: string;
  line: string;
}

/** The hits of one kind. */
export interface HitGroup {
  kind: ArticleKind;
  hits: Hit[];
}

/** Lower case without accents, so „ä“ finds „a“ and „Ä“ alike. */
export const fold = (s: string): string =>
  s
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss');

/** The words of a query, folded; empty words are left out. */
export const words = (query: string): string[] =>
  fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);

/** How well one word fits a document: 0 when it is not found. */
function wordScore(word: string, d: SearchDoc): number {
  const title = fold(d.title);
  if (d.ab && fold(d.ab) === word) return 90;
  if (title.startsWith(word)) return 80;
  if (words(d.title).some((w) => w.startsWith(word))) return 70;
  if (title.includes(word)) return 60;
  if (d.keywords.some((k) => fold(k).startsWith(word))) return 50;
  return fold(d.text).includes(word) ? 10 : 0;
}

/** The score of a document for all words; 0 unless every word is found. */
export function score(query: string, d: SearchDoc): number {
  const ws = words(query);
  if (!ws.length) return 0;
  let total = 0;
  for (const w of ws) {
    const s = wordScore(w, d);
    if (!s) return 0;
    total += s;
  }
  return total;
}

/**
 * The hits of a query, best first, grouped by kind: the group of the best
 * hit first. Ties keep the order of the articles.
 */
export function search(query: string, docs: readonly SearchDoc[]): HitGroup[] {
  const scored = docs
    .map((d, i) => ({ d, i, s: score(query, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const groups = new Map<ArticleKind, Hit[]>();
  for (const { d } of scored) {
    const hit: Hit = { id: d.id, title: d.title, line: d.line };
    if (d.ab) hit.ab = d.ab;
    const group = groups.get(d.kind);
    if (group) group.push(hit);
    else groups.set(d.kind, [hit]);
  }
  return [...groups].map(([kind, hits]) => ({ kind, hits }));
}
