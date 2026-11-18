// The marketplace in the browser (#171): the market from the state of the
// server, the draft of the form, the preview from the same function as the
// server, and the warning of the admin panel.
import { describe, expect, it } from 'vitest';
import { DEFAULT_RATIOS, type Market } from '../../core/market.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { planet } from '../../test/fixtures.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import {
  amountOf,
  draft,
  fixed,
  gainWarning,
  marketOf,
  maxAmount,
  newDraft,
  preview,
  targets,
} from './market.ts';
import type { GameState } from './types.ts';

const BASE = 1_000_000;
const PRICES = { mc: BASE, md: BASE, cm: BASE, cd: BASE, dm: BASE, dc: BASE };

/** The state of a player with the market on, as the server sends it. */
const state = (over: Partial<GameState> = {}): GameState =>
  ({
    round: { ...roundDefaults(), number: 1 },
    cfg: { ...DEFAULT_UNIVERSE },
    market: { prices: PRICES, used: 0 },
    ...over,
  }) as unknown as GameState;

/** A planet with a Handelsposten of level 1, 5,000 Adamant and 100 Psikristall. */
const post = (res = { m: 5000, c: 100, d: 0 }, level = 1) =>
  planet({ b: { market: level }, res });

/** The market of that planet in a round with the defaults. */
const market = (over: Partial<Market> = {}): Market => ({
  ...marketOf(state(), post())!,
  ...over,
});

describe('the market of the shown planet', () => {
  it('is built from the round, the planet, its storage and the prices of the server', () => {
    expect(
      marketOf(
        state({ market: { prices: { ...PRICES, mc: 909090 }, used: 250 } }),
        post(),
      ),
    ).toEqual({
      open: true,
      level: 1,
      stock: { m: 5000, c: 100, d: 0 },
      caps: { m: 100000, c: 100000, d: 100000 },
      ratios: DEFAULT_RATIOS,
      prices: { ...PRICES, mc: 909090 },
      used: 250,
      limit: 100000,
    });
  });

  it('is closed in a round with the marketplace off, and has the level of the Handelsposten', () => {
    const off = state({ round: { ...roundDefaults(), marketOn: 0 } as never });
    expect(marketOf(off, post())).toMatchObject({ open: false });
    expect(marketOf(state(), post(undefined, 7))).toMatchObject({ level: 7 });
    expect(marketOf(state(), planet())).toMatchObject({ level: 0 });
  });

  it('follows the ratios, the limit and the storage of the round and the planet', () => {
    const round = { ...roundDefaults(), marketMc: 800, marketLimit: 5000 };
    const m = marketOf(
      state({ round: round as never }),
      planet({ b: { market: 1, scrystal: 1 } }),
    )!;
    expect(m.ratios.mc).toBe(800);
    expect(m.limit).toBe(5000);
    expect(m.caps.c).toBe(150000);
  });

  it('is none before the server sent the prices', () => {
    expect(marketOf(state({ market: undefined }), post())).toBeNull();
  });
});

describe('the draft of the form', () => {
  it('starts with Adamant for Psikristall and no amount', () => {
    expect(newDraft()).toEqual({ give: 'm', get: 'c', amount: '' });
    expect(draft).toEqual(newDraft());
    expect(newDraft()).not.toBe(newDraft());
  });

  it('offers every resource but the one given', () => {
    expect(targets('m')).toEqual(['c', 'd']);
    expect(targets('c')).toEqual(['m', 'd']);
    expect(targets('d')).toEqual(['m', 'c']);
  });

  it('never gets what it gives: the first other resource then', () => {
    expect(fixed({ give: 'm', get: 'm', amount: '5' })).toEqual({
      give: 'm',
      get: 'c',
      amount: '5',
    });
    expect(fixed({ give: 'c', get: 'c', amount: '' }).get).toBe('m');
    const same = { give: 'm', get: 'd', amount: '' } as const;
    expect(fixed(same)).toBe(same);
  });

  it('reads the amount as typed: nothing while empty, a number else', () => {
    expect(amountOf('')).toBeNull();
    expect(amountOf('   ')).toBeNull();
    expect(amountOf('1000')).toBe(1000);
    expect(amountOf(' 12 ')).toBe(12);
    expect(amountOf('1.5')).toBe(1.5);
    expect(amountOf('abc')).toBeNaN();
  });
});

const draftOf = (amount: string, give = 'm', get = 'c') =>
  ({ give, get, amount }) as never;

describe('the preview', () => {
  it('shows the rate, the fee and what is left of the day while there is no amount', () => {
    expect(preview(market(), draftOf(''))).toEqual({
      lines: [
        { label: 'Kurs', value: '450 Psikristall je 1.000 Adamant' },
        { label: 'Gebühr', value: '10 %' },
        { label: 'Heute noch', value: '100.000 von 100.000' },
      ],
      note: null,
      ok: false,
    });
  });

  it('shows what is given and got and the fee in the resource got (the example of the issue)', () => {
    expect(preview(market(), draftOf('1000'))).toEqual({
      lines: [
        { label: 'Du gibst', value: '1.000 Adamant' },
        { label: 'Du erhältst', value: '450 Psikristall' },
        { label: 'Kurs', value: '450 Psikristall je 1.000 Adamant' },
        { label: 'Gebühr', value: '50 Psikristall (10 %)' },
        { label: 'Heute noch', value: '100.000 von 100.000' },
      ],
      note: null,
      ok: true,
    });
  });

  it('follows the pair, the price, the level and the day', () => {
    const lower = market({
      stock: { m: 5000, c: 100, d: 2000 },
      prices: { ...PRICES, dm: 500000 },
      level: 11,
      used: 30_000,
    });
    expect(preview(lower, draftOf('1000', 'd', 'm'))).toEqual({
      lines: [
        { label: 'Du gibst', value: '1.000 Promethium' },
        { label: 'Du erhältst', value: '1.500 Adamant' },
        { label: 'Kurs', value: '1.500 Adamant je 1.000 Promethium' },
        { label: 'Gebühr', value: '0 Adamant (0 %)' },
        { label: 'Heute noch', value: '70.000 von 100.000' },
      ],
      note: null,
      ok: true,
    });
    expect(preview(market({ level: 2 }), draftOf('')).lines[1]!.value).toBe(
      '9 %',
    );
  });

  it('says what the server would say when it refuses, without „Tauschen“', () => {
    const refused = preview(market(), draftOf('9999'));
    expect(refused.ok).toBe(false);
    expect(refused.note).toBe('So viel hast du auf diesem Planeten nicht.');
    expect(refused.lines.map((l) => l.label)).toEqual([
      'Kurs',
      'Gebühr',
      'Heute noch',
    ]);
    expect(preview(market(), draftOf('abc')).note).toBe(
      'Bitte eine ganze Menge von mindestens 1 angeben.',
    );
    expect(preview(market(), draftOf('0')).note).toBe(
      'Bitte eine ganze Menge von mindestens 1 angeben.',
    );
    expect(preview(market({ used: 99_500 }), draftOf('1000')).note).toBe(
      'Tageslimit erreicht: Heute kannst du noch 500 tauschen.',
    );
    expect(
      preview(market({ stock: { m: 5000, c: 100000, d: 0 } }), draftOf('1000'))
        .note,
    ).toBe('Das Lager für Psikristall ist voll.');
  });

  it('shows the cap of the free storage and what is really given', () => {
    const full = market({ stock: { m: 5000, c: 99_700.5, d: 0 } });
    expect(preview(full, draftOf('1000'))).toEqual({
      lines: [
        { label: 'Du gibst', value: '665 Adamant' },
        { label: 'Du erhältst', value: '299 Psikristall' },
        { label: 'Kurs', value: '450 Psikristall je 1.000 Adamant' },
        { label: 'Gebühr', value: '33 Psikristall (10 %)' },
        { label: 'Heute noch', value: '100.000 von 100.000' },
      ],
      note: 'Begrenzt durch das freie Lager: Du gibst nur 665 Adamant ab.',
      ok: true,
    });
  });
});

describe('„max“', () => {
  it('puts the most that can be given into the field', () => {
    expect(maxAmount(market(), draftOf(''))).toBe('5000');
    expect(maxAmount(market({ used: 98_000 }), draftOf(''))).toBe('2000');
    expect(
      maxAmount(
        market({ stock: { m: 5000, c: 99_700.5, d: 0 } }),
        draftOf('', 'm', 'c'),
      ),
    ).toBe('665');
    expect(maxAmount(market(), draftOf('', 'c', 'm'))).toBe('100');
  });

  it('leaves the field empty when nothing can be given', () => {
    expect(maxAmount(market({ used: 100_000 }), draftOf(''))).toBe('');
    expect(maxAmount(market({ level: 0 }), draftOf(''))).toBe('');
  });
});

describe('the warning of the admin panel (D2)', () => {
  it('is none for the default ratios, which follow the values 1, 2 and 3', () => {
    expect(gainWarning({ ...DEFAULT_UNIVERSE })).toBeNull();
    expect(gainWarning({} as never)).toBeNull();
  });

  it('names every round trip that gains, even without the fee', () => {
    expect(gainWarning({ ...DEFAULT_UNIVERSE, roundMarketMc: 501 })).toBe(
      'Achtung: Ein Tausch im Kreis bringt selbst ohne Gebühr Gewinn: Adamant → Psikristall → Adamant; Adamant → Psikristall → Promethium → Adamant. Bitte die Kurse anpassen.',
    );
    expect(gainWarning({ ...DEFAULT_UNIVERSE, roundMarketDc: 1502 })).toBe(
      'Achtung: Ein Tausch im Kreis bringt selbst ohne Gebühr Gewinn: Psikristall → Promethium → Psikristall; Adamant → Promethium → Psikristall → Adamant. Bitte die Kurse anpassen.',
    );
  });

  it('reads each ratio from its own key', () => {
    for (const [key, trip] of [
      ['roundMarketMd', 'Adamant → Promethium → Adamant'],
      ['roundMarketCm', 'Adamant → Psikristall → Adamant'],
      ['roundMarketCd', 'Psikristall → Promethium → Psikristall'],
      ['roundMarketDm', 'Adamant → Promethium → Adamant'],
    ] as const)
      expect(
        gainWarning({ ...DEFAULT_UNIVERSE, [key]: 100_000 }),
        key,
      ).toContain(trip);
  });
});
