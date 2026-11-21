// The pieces of #337 render as the HTML builders they replaced: `Cost`
// (costHTML), `Requirements` (requirementsHTML), `PlanetPicture` (planetHTML)
// and `MoonPicture` (moonPicture), frozen in src/test/html-pieces-frozen.ts.
// On generated cases (fixed fast-check seed 337) both render the same
// markup up to what a browser does not show (normalize() of markup.ts); a
// name with `<`, `&` and quotes must stay text, so an escaped name never equals
// the same name as markup. A frozen copy is never edited to make a test pass.
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from '../core/catalog.ts';
import type { Levels, Planet, ResearchState } from '../core/types.ts';
import type { GameState } from '../client/logic/types.ts';
import type { Ui, V } from '../client/views/common.ts';
import Cost from '../client/views/Cost.svelte';
import MoonPicture from '../client/views/MoonPicture.svelte';
import PlanetPicture from '../client/views/PlanetPicture.svelte';
import Requirements from '../client/views/Requirements.svelte';
import {
  costHTML,
  moonPicture,
  planetHTML,
  requirementsHTML,
} from './html-pieces-frozen.ts';
import { planet, U } from './fixtures.ts';
import { normalize } from './markup.ts';

const SEED = 337;

const same = (now: string, before: string): void =>
  expect(normalize(now)).toBe(normalize(before));

const amount = fc.oneof(
  fc.constant(0),
  fc.integer({ min: 1, max: 5_000 }),
  fc.integer({ min: 0, max: 5_000_000 }),
);

describe('Cost', () => {
  const cost = fc.tuple(amount, amount, amount);
  const res = fc.record({ m: amount, c: amount, d: amount });
  const energy = fc.option(
    fc.record({
      need: fc.integer({ min: 0, max: 9_999 }),
      production: fc.integer({ min: 0, max: 9_999 }),
    }),
    { nil: undefined },
  );

  it('equals costHTML on generated costs, stocks, counts and energy', () => {
    fc.assert(
      fc.property(
        cost,
        res,
        fc.integer({ min: 1, max: 6 }),
        energy,
        (c, r, n, e) => {
          const P = planet({ res: r });
          same(
            render(Cost, { props: { cost: c, P, n, energy: e } }).body,
            costHTML(c, P, n, e),
          );
          same(
            render(Cost, { props: { cost: c, P, energy: e } }).body,
            costHTML(c, P, 1, e),
          );
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  it('marks the part the planet cannot pay, and shows no part without a price', () => {
    const P = planet({ res: { m: 10, c: 0, d: 0 } });
    const html = normalize(
      render(Cost, { props: { cost: [10, 5, 0], P } }).body,
    );
    expect(html).toBe(normalize(costHTML([10, 5, 0], P)));
    expect(html).toContain('<b class="bad">5</b>');
    expect(html).not.toContain('Promethium');
    expect(html).not.toContain('<b class="bad">10</b>');
  });

  it('shows no energy part for an energy of 0', () => {
    const P = planet();
    const e = { need: 0, production: 5 };
    same(
      render(Cost, { props: { cost: [1, 0, 0], P, energy: e } }).body,
      costHTML([1, 0, 0], P, 1, e),
    );
  });
});

describe('PlanetPicture', () => {
  it('equals planetHTML on generated places, still or not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 1, max: 499 }),
        fc.integer({ min: 1, max: 15 }),
        fc.boolean(),
        (g, s, p, still) => {
          const c = { g, s, p };
          same(
            render(PlanetPicture, { props: { c, still } }).body,
            planetHTML(c, still),
          );
          same(render(PlanetPicture, { props: { c } }).body, planetHTML(c));
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe('MoonPicture', () => {
  const NAMES = [
    'Luna',
    'Mond <b>&"\'</b>',
    'x" onerror="alert(1)',
    '&amp; <img src=x>',
    '',
  ];

  it('equals moonPicture on generated names and sizes', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...NAMES), fc.string()),
        fc.constantFrom(20, 28, 120),
        (name, size) => {
          same(
            render(MoonPicture, { props: { name, size } }).body,
            moonPicture(name, size),
          );
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  it('shows a name as text of the alt attribute, never as markup', () => {
    const body = render(MoonPicture, {
      props: { name: 'a<b>&"c', size: 28 },
    }).body;
    expect(body).not.toContain('<b>');
    expect(body).toContain('alt="a&lt;b>&amp;&quot;c"');
  });
});

describe('Requirements', () => {
  const levels = (keys: string[], max: number): fc.Arbitrary<Levels> =>
    fc.record(
      Object.fromEntries(keys.map((k) => [k, fc.integer({ min: 0, max })])),
      { requiredKeys: [] },
    ) as fc.Arbitrary<Levels>;

  const time = fc.integer({ min: 0, max: 2_000_000 });

  const ENTRIES = [
    ...Object.entries(BUILD),
    ...Object.entries(RES),
    ...Object.entries(SHIPS),
    ...Object.entries(DEF),
  ]
    .filter(([, d]) => (d as { req?: unknown }).req)
    .map(([key, d]) => ({ key, req: (d as { req: never }).req }));

  /** A shown planet and research, as far as the requirements read them. */
  const state = fc.record({
    P: fc.record({
      kind: fc.constantFrom('planet' as const, 'moon' as const),
      diameter: fc.integer({ min: 1000, max: 16000 }),
      res: fc.record({
        m: fc.integer({ min: 0, max: 5_000_000 }),
        c: fc.integer({ min: 0, max: 5_000_000 }),
        d: fc.integer({ min: 0, max: 2_000_000 }),
      }),
      b: levels(Object.keys(BUILD), 14),
      bq: fc.option(
        fc.record({
          key: fc.constantFrom(...Object.keys(BUILD)),
          lvl: fc.integer({ min: 1, max: 15 }),
          start: time,
          end: time,
          cost: fc.constant([0, 0, 0] as [number, number, number]),
        }),
        { nil: null },
      ),
      sq: fc.array(
        fc.record({
          key: fc.constantFrom(...Object.keys(SHIPS)),
          n: fc.integer({ min: 1, max: 50 }),
          unit: fc.integer({ min: 1, max: 600_000 }),
        }),
        { maxLength: 2 },
      ),
    }),
    research: levels(Object.keys(RES), 13),
    rq: fc.option(
      fc.record({
        key: fc.constantFrom(...Object.keys(RES)),
        lvl: fc.integer({ min: 1, max: 14 }),
        start: time,
        end: time,
        cost: fc.constant([0, 0, 0] as [number, number, number]),
      }),
      { nil: undefined },
    ),
    entry: fc.constantFrom(...ENTRIES),
  });

  const view = (x: {
    P: Partial<Planet>;
    research: Levels;
    rq: ResearchState['rq'];
  }): V => {
    const P: Planet = planet(x.P);
    return {
      s: { cfg: U, me: { id: 'u1' } } as unknown as GameState,
      P,
      R: { research: x.research, rq: x.rq } as ResearchState,
      now: 1_000_000,
      ui: {} as unknown as Ui,
    };
  };

  it('has entries with requirements to compare', () => {
    expect(ENTRIES.length).toBeGreaterThan(10);
  });

  /** Markup of every branch of the list, for the check that the cases reach them. */
  const MARKS = [
    'class="need ready"',
    'class="need missing"',
    'data-act="build"',
    'data-act="research"',
    'disabled',
    'class="via"',
    'class="why"',
    'class="cost"',
    'Energieproduktion',
    'braucht ',
    'zu wenig ',
  ];

  it('equals requirementsHTML on generated states of every entry with requirements', () => {
    const seen = new Set<string>();
    let empty = 0;
    fc.assert(
      fc.property(state, (x) => {
        const v = view(x);
        const before = requirementsHTML(v, x.entry.req);
        const now = render(Requirements, {
          props: { v, req: x.entry.req },
        }).body;
        same(now, before);
        if (!before) empty++;
        for (const m of MARKS) if (before.includes(m)) seen.add(m);
      }),
      { seed: SEED, numRuns: 600 },
    );
    expect(empty).toBeGreaterThan(0);
    // `disabled` (a start button that waits) and the energy cost need a hand-built case.
    const missing = MARKS.filter(
      (m) => !seen.has(m) && m !== 'disabled' && m !== 'Energieproduktion',
    );
    expect(missing).toEqual([]);
  });

  it('equals requirementsHTML where a start button waits and where an energy cost shows', () => {
    // Rich planets with some levels, once with a running building (the
    // button waits: `disabled`) and once idle; the energy part of a cost line
    // comes from an entry whose next level needs energy production.
    const seen = new Set<string>();
    for (const bq of [
      null,
      {
        key: 'lab',
        lvl: 2,
        start: 0,
        end: 9,
        cost: [0, 0, 0] as [number, number, number],
      },
    ]) {
      for (const lvl of [0, 1, 3, 6, 30]) {
        const v = view({
          P: {
            kind: 'planet',
            diameter: 16000,
            res: { m: 9_000_000, c: 9_000_000, d: 9_000_000 },
            b: Object.fromEntries(Object.keys(BUILD).map((k) => [k, lvl])),
            bq,
            sq: [],
          },
          research: Object.fromEntries(
            Object.keys(RES).map((k) => [k, k === 'graviton' ? 0 : lvl]),
          ),
          rq: undefined,
        });
        for (const { req } of ENTRIES) {
          const before = requirementsHTML(v, req);
          same(render(Requirements, { props: { v, req } }).body, before);
          for (const m of MARKS) if (before.includes(m)) seen.add(m);
        }
      }
    }
    expect(seen.has('disabled')).toBe(true);
    expect(seen.has('Energieproduktion')).toBe(true);
  });

  it('shows nothing without a requirement and without an unmet one', () => {
    const v = view({
      P: {
        kind: 'planet',
        diameter: 12800,
        res: { m: 0, c: 0, d: 0 },
        b: {},
        bq: null,
        sq: [],
      },
      research: {},
      rq: undefined,
    });
    expect(
      normalize(render(Requirements, { props: { v, req: undefined } }).body),
    ).toBe(normalize(requirementsHTML(v, undefined)));
    expect(requirementsHTML(v, undefined)).toBe('');
  });
});
