// The pages of the Lexicanum register themselves (#426): the generated list
// holds every page file, and the order of the start page comes from the order
// of each page.
import { describe, expect, it } from 'vitest';
import type { PageDef } from '../types.ts';
import { assemblePages, PAGES } from './index.ts';
import { LEXICON_PAGES } from './pages.gen.ts';

/** A page with only what the assembly reads. */
const page = (id: string): PageDef => ({ id }) as PageDef;

describe('the pages of the Lexicanum (#426)', () => {
  it('sorts the pages by their order, not by the file names', () => {
    const a = page('rule-a');
    const b = page('rule-b');
    const c = page('rule-c');
    expect(
      assemblePages([
        ['a', { order: 30, page: a }],
        ['b', { order: 10, page: b }],
        ['c', { order: 20, page: c }],
      ]),
    ).toEqual([b, c, a]);
    expect(assemblePages([])).toEqual([]);
  });

  it('stops at an order defined twice and names both files', () => {
    expect(() =>
      assemblePages([
        ['a', { order: 10, page: page('rule-a') }],
        ['b', { order: 10, page: page('rule-b') }],
      ]),
    ).toThrow(
      'Lexicanum page order 10 is defined twice: in src/core/lexicon/pages/a.ts and in src/core/lexicon/pages/b.ts.',
    );
  });

  it('stops at an address defined twice and names both files', () => {
    expect(() =>
      assemblePages([
        ['a', { order: 10, page: page('rule-a') }],
        ['b', { order: 20, page: page('rule-a') }],
      ]),
    ).toThrow(
      'Lexicanum page address rule-a is defined twice: in src/core/lexicon/pages/a.ts and in src/core/lexicon/pages/b.ts.',
    );
  });

  it('stops at a page without an order', () => {
    for (const order of [Number.NaN, Infinity, undefined])
      expect(() =>
        assemblePages([
          ['a', { order: order as number, page: page('rule-a') }],
        ]),
      ).toThrow(
        'Lexicanum page rule-a in src/core/lexicon/pages/a.ts has no order.',
      );
  });

  it('is the generated list in its order, each page once', () => {
    expect(PAGES).toEqual(
      [...LEXICON_PAGES]
        .sort(([, x], [, y]) => x.order - y.order)
        .map(([, entry]) => entry.page),
    );
    expect(new Set(LEXICON_PAGES.map(([, e]) => e.order)).size).toBe(
      LEXICON_PAGES.length,
    );
  });
});
