// The pages of the Lexicanum that are written, in the order of the start
// page: the rule pages and the questions of stage 2 (#288) and the guides of
// stage 3 (#289). Every page file registers itself (#426): it exports
// `lexiconPage`, its page with its place `order`, and the generated list
// pages.gen.ts (scripts/gen-features.ts) names every file of this folder that
// does. The pages go by ascending order; an order or an address defined twice
// stops the start with both files named, so no page silently replaces another.
import { ownedOnce } from '../../owned-once.ts';
import type { PageDef } from '../types.ts';
import { LEXICON_PAGES } from './pages.gen.ts';

/** What a page file exports as `lexiconPage`. */
interface LexiconPage {
  /** Its place on the start page: the pages go by ascending order. */
  order: number;
  page: PageDef;
}

/** The modules as the generated list gives them: `[name in this folder, lexiconPage]`. */
type ListedPages = readonly (readonly [string, LexiconPage])[];

/** The pages of all modules by ascending order, each order and address once. */
export function assemblePages(listed: ListedPages): readonly PageDef[] {
  const once = ownedOnce('Lexicanum page');
  for (const [name, { order, page }] of listed) {
    const file = `src/core/lexicon/pages/${name}.ts`;
    if (!Number.isFinite(order))
      throw new Error(`Lexicanum page ${page.id} in ${file} has no order.`);
    once('order', String(order), file);
    once('address', page.id, file);
  }
  return [...listed]
    .map(([, entry]) => entry)
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.page);
}

export const PAGES: readonly PageDef[] = assemblePages(LEXICON_PAGES);
