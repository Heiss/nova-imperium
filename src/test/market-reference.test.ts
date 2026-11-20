// „Marktplatz“ renders as before #118, bundle 7 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: market() of src/client/views/market.ts with its
// options, the preview and box() of views/common.ts. On generated states
// (fixed fast-check seed 118) the component renders the same markup, up to
// what a browser does not show (normalize() of markup.ts) and with the same
// text in every element (textContents()); hand-built cases reach what the
// sample reaches rarely: the market off for the round, no prices yet, no
// Handelsposten, the limit of the day reached and cutting an amount, the fee
// per level, a price at its lowest, an empty stock, a full storage. The hooks
// the handlers read (features/market.ts, main.ts) are pinned below.
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOSED, tradeNote } from '../core/market-text.ts';
import {
  PAIRS,
  PRICE_UNIT,
  type Res,
  RES_NAME,
  TRADED,
} from '../core/market.ts';
import { DEFAULT_UNIVERSE } from '../core/universe.ts';
import { esc } from '../client/logic/format.ts';
import {
  type Draft,
  draft,
  fixed,
  marketOf,
  newDraft,
  preview,
  type Preview,
  targets,
} from '../client/logic/market.ts';
import type { GameState } from '../client/logic/types.ts';
import type { V } from '../client/views/common.ts';
import { planet, roundDefaults } from './fixtures.ts';
import { marketView } from './market-view.ts';
import { normalize, textContents } from './markup.ts';

// ----- frozen: the view before #118, bundle 7 -----

const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

const options = (list: readonly Res[], chosen: Res): string =>
  list
    .map(
      (r) =>
        `<option value="${r}"${r === chosen ? ' selected' : ''}>${RES_NAME[r]}</option>`,
    )
    .join('');

const targetOptions = (d: Draft): string => options(targets(d.give), d.get);

function previewHTML(p: Preview): string {
  const rows = p.lines
    .map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.value)}</td></tr>`)
    .join('');
  const note = p.note
    ? `<p class="${p.ok ? 'dim' : 'bad'}">${esc(p.note)}</p>`
    : '';
  return `<table class="kv">${rows}</table>${note}`;
}

function market(v: V): string {
  const m = marketOf(v.s, v.P);
  const head = '<h2>Marktplatz</h2>';
  if (!m?.open) return `${head}<div class="notice">${CLOSED}</div>`;
  if (m.level < 1)
    return `${head}<div class="notice">${esc(tradeNote('noPost', m, 'm'))} Baue ihn unter „Gebäude“.</div>`;
  const d = fixed(draft);
  const p = preview(m, d);
  return `${head}${box(
    'Tauschen',
    `<form id="marketform">
  <p><label for="market-give">Du gibst</label> <select id="market-give">${options(TRADED, d.give)}</select></p>
  <p><label for="market-get">Du erhältst</label> <select id="market-get">${targetOptions(d)}</select></p>
  <p><label for="market-amount">Menge</label> <input type="number" id="market-amount" min="1" step="1" inputmode="numeric" autocomplete="off" value="${esc(d.amount)}"> <button type="button" data-act="marketMax">max</button></p>
  <div id="market-preview" role="status">${previewHTML(p)}</div>
  <p><button type="submit" id="market-trade"${p.ok ? '' : ' disabled'}>Tauschen</button></p>
</form>`,
  )}`;
}

// ----- the comparison -----

afterEach(() => Object.assign(draft, newDraft()));

interface Case {
  v: V;
  draft: Draft;
}

interface Shape {
  on?: number;
  prices?: boolean;
  level?: number;
  limit?: number;
  used?: number;
  fee?: number;
  feeStep?: number;
  price?: number;
  stock?: { m: number; c: number; d: number };
  storage?: number;
  draft?: Partial<Draft>;
}

/** The state of the round and the prices of the server. */
function stateOf(x: Shape): GameState {
  const price = x.price ?? PRICE_UNIT;
  const prices = Object.fromEntries(PAIRS.map((p) => [p, price]));
  return {
    round: {
      ...roundDefaults(),
      number: 1,
      marketOn: x.on ?? 1,
      marketLimit: x.limit ?? 100_000,
      marketFee: x.fee ?? 10,
      marketFeeStep: x.feeStep ?? 1,
    },
    cfg: { ...DEFAULT_UNIVERSE },
    market: x.prices === false ? undefined : { prices, used: x.used ?? 0 },
  } as unknown as GameState;
}

/** The planet with its Handelsposten, its storage and its stock. */
const planetOf = (x: Shape) =>
  planet({
    b: {
      market: x.level ?? 1,
      smetal: x.storage ?? 0,
      scrystal: x.storage ?? 0,
      sdeut: x.storage ?? 0,
    },
    res: x.stock ?? { m: 5000, c: 100, d: 0 },
  });

/** The view of a player on a planet, and the draft of the form. */
const caseOf = (x: Shape): Case => ({
  v: { s: stateOf(x), P: planetOf(x) } as unknown as V,
  draft: { ...newDraft(), ...x.draft },
});

/** The component and the frozen view of one case; the draft is the one of the form. */
function both(c: Case): [component: string, frozen: string] {
  Object.assign(draft, c.draft);
  return [marketView(c.v), market(c.v)];
}

const res = fc.constantFrom<Res>('m', 'c', 'd');
const amounts = [
  '',
  '1',
  '7',
  '1000',
  '4999',
  '5000',
  '5001',
  '99999',
  '999999',
  '0',
  '-5',
  '1.5',
  'abc',
  '"><b>',
  "O'Brien & Co",
  ' 12 ',
];

const shape = fc.record({
  on: fc.constantFrom(1, 1, 1, 0),
  prices: fc.boolean(),
  level: fc.integer({ min: 0, max: 6 }),
  limit: fc.constantFrom(0, 1000, 100_000),
  used: fc.constantFrom(0, 500, 999, 1000, 100_000, 250_000),
  fee: fc.constantFrom(0, 10, 100),
  feeStep: fc.constantFrom(0, 1, 50),
  price: fc.constantFrom(0, 1, 500_000, PRICE_UNIT),
  stock: fc.record({
    m: fc.constantFrom(0, 1, 4999.7, 5000, 99_700.5, 1_000_000),
    c: fc.constantFrom(0, 100, 99_700.5, 1_000_000),
    d: fc.constantFrom(0, 3, 50_000),
  }),
  storage: fc.constantFrom(0, 1, 3),
  draft: fc.record({
    give: res,
    get: res,
    amount: fc.constantFrom(...amounts),
  }),
});

/** The cases the sample reaches rarely. */
const HAND_BUILT: [string, Shape][] = [
  ['the market off for the round', { on: 0, draft: { amount: '1000' } }],
  ['no prices of the server yet', { prices: false }],
  ['no Handelsposten on the planet', { level: 0 }],
  [
    'a limit of the day that is reached',
    { limit: 1000, used: 1000, draft: { amount: '10' } },
  ],
  [
    'a limit of the day that cuts the amount',
    { limit: 1000, used: 500, draft: { amount: '1000' } },
  ],
  ['no limit', { limit: 0, draft: { amount: '1000' } }],
  ...[1, 2, 3, 5, 6].map((level): [string, Shape] => [
    `the fee of level ${level}`,
    { level, draft: { amount: '1000' } },
  ]),
  ['a fee of 0 %', { fee: 0, feeStep: 0, draft: { amount: '1000' } }],
  ['a price at its lowest', { price: 0, draft: { amount: '1000' } }],
  ['a price that fell', { price: 500_000, draft: { amount: '1000' } }],
  ['an empty stock', { stock: { m: 0, c: 0, d: 0 }, draft: { amount: '1' } }],
  [
    'a full storage that caps the amount',
    {
      stock: { m: 5000, c: 99_700.5, d: 0 },
      draft: { amount: '1000' },
    },
  ],
  [
    'an amount with markup',
    { draft: { give: 'c', get: 'c', amount: '"><b>' } },
  ],
  ['the same resource to give and to get', { draft: { give: 'd', get: 'd' } }],
  ...PAIRS.map((pair): [string, Shape] => [
    `the pair ${pair}`,
    {
      draft: { give: pair[0] as Res, get: pair[1] as Res, amount: '100' },
      stock: { m: 5000, c: 5000, d: 5000 },
    },
  ]),
];

describe('Marktplatz against the view before #118, bundle 7', () => {
  it('renders the page as before', () => {
    fc.assert(
      fc.property(shape, (x) => {
        const [component, frozen] = both(caseOf(x));
        expect(normalize(component)).toBe(normalize(frozen));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, x] of HAND_BUILT) {
      const [component, frozen] = both(caseOf(x));
      expect(normalize(component), name).toBe(normalize(frozen));
    }
  });

  it('keeps the text of every element as before', () => {
    fc.assert(
      fc.property(shape, (x) => {
        const [component, frozen] = both(caseOf(x));
        expect(textContents(component)).toEqual(textContents(frozen));
      }),
      { seed: 118, numRuns: 300 },
    );
    for (const [name, x] of HAND_BUILT) {
      const [component, frozen] = both(caseOf(x));
      expect(textContents(component), name).toEqual(textContents(frozen));
    }
  });

  it('reaches the pages the sample is meant to compare', () => {
    const all = HAND_BUILT.map(([, x]) => both(caseOf(x))[0]).join('\n');
    for (const mark of [
      'class="notice"',
      CLOSED,
      'Auf diesem Planeten fehlt ein Handelsposten. Baue ihn unter „Gebäude“.',
      'kein Limit',
      'Tageslimit erreicht',
      'Begrenzt durch das Tageslimit',
      'Begrenzt durch das freie Lager',
      'So viel hast du auf diesem Planeten nicht.',
      'Für diese Menge bekommst du nichts.',
      '(10 %)',
      '(9 %)',
      '(8 %)',
      '(0 %)',
      '<p class="bad">',
      '<p class="dim">',
      ' disabled',
      '&lt;b',
    ])
      expect(all.includes(mark), mark).toBe(true);
  });

  it('keeps every hook the handlers read', () => {
    const [html] = both(caseOf({ draft: { amount: '1000' } }));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of [
      'marketform',
      'market-give',
      'market-get',
      'market-amount',
      'market-preview',
      'market-trade',
    ])
      expect(ids, id).toContain(id);
    expect(html).toContain('data-act="marketMax"');
    expect(html).toContain('<div id="market-preview" role="status">');
    expect(html).toContain('for="market-give"');
    expect(html).toContain('for="market-get"');
    expect(html).toContain('for="market-amount"');
  });
});
