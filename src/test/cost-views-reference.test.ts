// The level table and the article of the Lexicanum show their costs as the
// frozen costHTML() did (#337, src/test/html-pieces-frozen.ts). `LevelTable`
// and `LexicanumArticle` are checked by what they take from costHTML: every
// cost line of the rendered markup, in order, equals costHTML() of the cost
// the model holds (the cost of a unit in the head of an article, then the cost
// of every row of its level tables), on generated stocks of the planet; the
// rest of the markup is tested in the unit tests of the views. A frozen copy
// is never edited to make a test pass.
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { BUILD, RES } from '../core/catalog.ts';
import { ARTICLES } from '../core/lexicon/articles.ts';
import { articleView } from '../client/logic/lexicanum.ts';
import { levelTable } from '../client/logic/level-table.ts';
import LevelTable from '../client/views/LevelTable.svelte';
import LexicanumArticle from '../client/views/LexicanumArticle.svelte';
import { costHTML } from './html-pieces-frozen.ts';
import { roundDefaults } from './fixtures.ts';
import { levelView } from './level-view.ts';
import { normalize } from './markup.ts';

const SEED = 337;

/** The cost lines of the markup in order (a cost line holds no other `div`). */
const costs = (html: string): string[] =>
  [...html.matchAll(/<div class="cost">.*?<\/div>/gs)].map((m) =>
    normalize(m[0]),
  );

const res = fc.record({
  m: fc.integer({ min: 0, max: 3_000_000 }),
  c: fc.integer({ min: 0, max: 3_000_000 }),
  d: fc.integer({ min: 0, max: 1_000_000 }),
});

const KEYS = [...Object.keys(BUILD), ...Object.keys(RES)];

describe('LevelTable', () => {
  it('shows the cost of every row as costHTML did, in the Lexicanum and in the level overview', () => {
    fc.assert(
      fc.property(
        res,
        fc.constantFrom(...KEYS),
        fc.integer({ min: 0, max: 12 }),
        fc.boolean(),
        (r, key, own, overview) => {
          const v = levelView({ res: r, b: { [key]: own } }, { [key]: own });
          const table = levelTable(v, key);
          if (!table) return;
          const html = render(LevelTable, {
            props: { table, P: v.P, overview },
          }).body;
          expect(costs(html)).toEqual(
            table.rows.map((row) => normalize(costHTML(row.cost, v.P))),
          );
          expect(costs(html).length).toBeGreaterThan(0);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe('LexicanumArticle', () => {
  /** What the article shows of costHTML: the unit cost, then the rows of its level tables. */
  const expected = (
    view: NonNullable<ReturnType<typeof articleView>>,
    P: ReturnType<typeof levelView>['P'],
  ): string[] => [
    ...(view.cost ? [normalize(costHTML(view.cost, P))] : []),
    ...view.sections.flatMap((s) =>
      s.blocks.flatMap((b) =>
        b.t === 'levels'
          ? b.table.rows.map((row) => normalize(costHTML(row.cost, P)))
          : [],
      ),
    ),
  ];

  it('shows the cost of a unit and of the level rows as costHTML did, for every article', () => {
    let withUnitCost = 0;
    let withTable = 0;
    fc.assert(
      fc.property(res, fc.boolean(), (r, panel) => {
        const v = levelView({ res: r }, {}, [], {});
        Object.assign(v.s, {
          round: { number: 1, ...roundDefaults() },
          players: {},
          fleets: [],
        });
        for (const a of ARTICLES) {
          const view = articleView(a.id, v);
          if (!view) continue;
          const html = render(LexicanumArticle, {
            props: { article: view, P: v.P, panel },
          }).body;
          const want = expected(view, v.P);
          expect(costs(html)).toEqual(want);
          if (view.cost) withUnitCost++;
          if (want.length > (view.cost ? 1 : 0)) withTable++;
        }
      }),
      { seed: SEED, numRuns: 5 },
    );
    expect(withUnitCost).toBeGreaterThan(0);
    expect(withTable).toBeGreaterThan(0);
  });
});
