// The marketplace („Marktplatz“, #171, okf/features/marketplace.md): a
// player exchanges one resource for another at the ratios the admin sets in
// the admin panel. The rules are pure functions of integers, used by the
// server and the browser (patterns, section 7); the server words the codes.
//
// Owner's decisions („Geklärt“, 2026-11-17): moving prices (D1: the ratios
// of the admin are the base prices, an exchange shifts the price of its
// pair by a share of the amount traded, and it drifts back to the base over
// a set time), a ratio per pair, six numbers, and a warning when a round
// trip would gain (D2), the building „Handelsposten“ whose levels lower the
// fee (D3), the result capped by the free storage (D4), a limit per player
// per day (D5), on by default in a new round (D6), all per-round values live
// in „Neue Runde“ and stay editable during the round (X1). Adamant,
// Psikristall and Promethium can be traded, energy cannot.
//
// Everything below the decisions is [V] (okf/features/marketplace.md):
// the unit of a ratio, the ranges and defaults, the formula of the shift and
// of the drift, the fee at a level, the rounding.
//
// Rounding: every product is an integer and every division rounds down, so
// an exchange never gives more than the ratio says. A price is never above
// its base and a fee is never negative, so a chain of exchanges returns at
// most what it started with unless the admin's ratios themselves gain on a
// round trip (`gainingTrips` names those, the panel warns).
import type { RoundGroup, RoundSetting } from './round.ts';
import type { Planet, Resources } from './types.ts';

/** A resource: Adamant `m`, Psikristall `c`, Promethium `d`; energy is no resource here. */
export type Res = keyof Resources;

/** The resources that can be traded, in the order of the interface. */
export const TRADED: readonly Res[] = ['m', 'c', 'd'];

/** The German name of each resource. */
export const RES_NAME: Readonly<Record<Res, string>> = {
  m: 'Adamant',
  c: 'Psikristall',
  d: 'Promethium',
};

/** An ordered pair: the resource given, then the resource got (`mc`: Adamant for Psikristall). */
export type Pair = 'mc' | 'md' | 'cm' | 'cd' | 'dm' | 'dc';

/** The six pairs in the order of the settings. */
export const PAIRS: readonly Pair[] = ['mc', 'md', 'cm', 'cd', 'dm', 'dc'];

/** The pair of two resources; null for the same resource or a resource that is not traded. */
export function pairOf(give: unknown, get: unknown): Pair | null {
  const pair = `${String(give)}${String(get)}`;
  return (PAIRS as readonly string[]).includes(pair) ? (pair as Pair) : null;
}

/** A ratio is the amount got for 1,000 given, at the base price and without the fee [V]. */
export const RATIO_UNIT = 1000;
/** The price is a factor in millionths of the base price; 1,000,000 is the base [V]. */
export const PRICE_UNIT = 1_000_000;
/** The fee is in thousandths of the result [V]. */
export const FEE_UNIT = 1000;

/** The range of a ratio [V]: 0.001 to 100 got for one given. */
export const RATIO_RANGE = { min: 1, max: 100_000 } as const;

/**
 * The ratios of a new round [V]: Adamant 1, Psikristall 2, Promethium 3 (the
 * example of the issue), each ratio rounded down to a whole number, so no
 * round trip gains and the panel shows no warning.
 */
export const DEFAULT_RATIOS: Readonly<Record<Pair, number>> = {
  mc: 500,
  md: 333,
  cm: 2000,
  cd: 666,
  dm: 3000,
  dc: 1500,
};

/**
 * The shift of the price per exchange [V]: this many millionths of the
 * price per unit given, so 1,000 units given shift it by this many
 * thousandths. Default 5: 20,000 units given lower the price by about 10 %.
 */
export const STEP = { min: 1, max: 1000, def: 5 } as const;
/** The time a price needs to drift back to the base, in whole hours [V]. */
export const DRIFT_HOURS = { min: 1, max: 720, def: 24 } as const;
/** The amount a player may give per UTC day, summed over all resources [V]. */
export const DAILY_LIMIT = { min: 1, max: 10_000_000, def: 100_000 } as const;

/** The fee at level 1 of the Handelsposten, in thousandths: 10 % [V]. */
export const FEE_BASE = 100;
/** What every further level takes off the fee, in thousandths: 1 percentage point [V]. */
export const FEE_STEP = 10;

/** One hour in milliseconds; the drift runs in real time. */
export const HOUR_MS = 3_600_000;
/** One UTC day in milliseconds; the limit counts per UTC day, as the daily reward. */
export const DAY_MS = 86_400_000;

/** The number of the UTC day of a time; the limit counts the amounts of one day. */
export const dayOf = (time: number): number => Math.floor(time / DAY_MS);

/** The fee in thousandths at a level of the Handelsposten (1 or more): never below 0. */
export const feeAt = (level: number): number =>
  Math.max(0, FEE_BASE - FEE_STEP * (level - 1));

/** The level of the Handelsposten on a planet; 0 without one. */
export const postLevel = (p: Pick<Planet, 'b'>): number => p.b.market ?? 0;

/** The group of the settings in the dialog „Neue Runde“ and in the universe settings. */
const MARKET_GROUP: RoundGroup = { name: 'market', legend: 'Marktplatz' };

/** What the nine numbers have in common as settings of the round. */
const number = {
  kind: 'number',
  group: MARKET_GROUP,
  live: true,
} as const;

/** The label of a ratio: „Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant)“. */
const ratioLabel = (give: Res, get: Res): string =>
  `Marktplatz ${RES_NAME[give]} → ${RES_NAME[get]} (${RES_NAME[get]} je 1.000 ${RES_NAME[give]})`;

/** A ratio as a setting of the round: the range and the default are the same for every pair. */
const ratio = (pair: Pair) =>
  ({
    ...number,
    min: RATIO_RANGE.min,
    max: RATIO_RANGE.max,
    def: DEFAULT_RATIOS[pair],
  }) as const;

/**
 * The marketplace as settings of the round (#171, #283, #310): number
 * fields of the dialog „Neue Runde“ in one fieldset and, `live`, rows of the
 * universe settings, changed during the round (X1). The switch is a number
 * of 1 (yes) and 0 (no), because a switch of the registry cannot be live.
 * The export under this name registers them (src/core/round.ts).
 */
export const roundSettings = [
  {
    ...number,
    key: 'roundMarketOn',
    name: 'marketOn',
    label: 'Marktplatz aktiv',
    order: 320,
    min: 0,
    max: 1,
    def: 1,
    choices: [
      { value: 1, label: 'Ja' },
      { value: 0, label: 'Nein' },
    ],
  },
  {
    ...ratio('mc'),
    key: 'roundMarketMc',
    name: 'marketMc',
    label: ratioLabel('m', 'c'),
    order: 330,
  },
  {
    ...ratio('md'),
    key: 'roundMarketMd',
    name: 'marketMd',
    label: ratioLabel('m', 'd'),
    order: 340,
  },
  {
    ...ratio('cm'),
    key: 'roundMarketCm',
    name: 'marketCm',
    label: ratioLabel('c', 'm'),
    order: 350,
  },
  {
    ...ratio('cd'),
    key: 'roundMarketCd',
    name: 'marketCd',
    label: ratioLabel('c', 'd'),
    order: 360,
  },
  {
    ...ratio('dm'),
    key: 'roundMarketDm',
    name: 'marketDm',
    label: ratioLabel('d', 'm'),
    order: 370,
  },
  {
    ...ratio('dc'),
    key: 'roundMarketDc',
    name: 'marketDc',
    label: ratioLabel('d', 'c'),
    order: 380,
  },
  {
    ...number,
    key: 'roundMarketStep',
    name: 'marketStep',
    label: 'Marktplatz Preisschritt (Promille je 1.000 getauschte Einheiten)',
    order: 390,
    min: STEP.min,
    max: STEP.max,
    def: STEP.def,
  },
  {
    ...number,
    key: 'roundMarketDrift',
    name: 'marketDrift',
    label: 'Marktplatz Preiserholung (Stunden)',
    order: 400,
    min: DRIFT_HOURS.min,
    max: DRIFT_HOURS.max,
    def: DRIFT_HOURS.def,
  },
  {
    ...number,
    key: 'roundMarketLimit',
    name: 'marketLimit',
    label: 'Marktplatz Tageslimit je Spieler (Einheiten)',
    order: 410,
    min: DAILY_LIMIT.min,
    max: DAILY_LIMIT.max,
    def: DAILY_LIMIT.def,
  },
] as const satisfies readonly RoundSetting[];

/** The nine values of the round the market is read from (the round rules carry them). */
export interface MarketRound {
  marketOn: number;
  marketMc: number;
  marketMd: number;
  marketCm: number;
  marketCd: number;
  marketDm: number;
  marketDc: number;
  marketStep: number;
  marketDrift: number;
  marketLimit: number;
}

/** Whether the marketplace is on in the round. */
export const marketOpen = (round: Pick<MarketRound, 'marketOn'>): boolean =>
  round.marketOn === 1;

/** The ratio of each pair, from the rules of the round. */
export const ratiosOf = (round: MarketRound): Record<Pair, number> => ({
  mc: round.marketMc,
  md: round.marketMd,
  cm: round.marketCm,
  cd: round.marketCd,
  dm: round.marketDm,
  dc: round.marketDc,
});

/**
 * The trips, round trips through two or three resources, that gain
 * resources at the ratios even without a fee and at the base price: the
 * product of their ratios is above 1,000 to the power of their length. A
 * longer trip is made of these, so no other trip needs a check. The panel
 * warns about each one (D2, owner, 2026-11-17).
 */
export function gainingTrips(ratios: Readonly<Record<Pair, number>>): Res[][] {
  const trips: Res[][] = [
    ['m', 'c'],
    ['m', 'd'],
    ['c', 'd'],
    ['m', 'c', 'd'],
    ['m', 'd', 'c'],
  ];
  return trips.filter((trip) => {
    let product = 1n;
    for (const [i, from] of trip.entries()) {
      const to = trip[(i + 1) % trip.length]!;
      product *= BigInt(ratios[pairOf(from, to)!]);
    }
    return product > BigInt(RATIO_UNIT) ** BigInt(trip.length);
  });
}

/** The price of a pair: its factor to the base and when it was set. */
export interface PriceState {
  /** In millionths of the base price, at most `PRICE_UNIT`. */
  price: number;
  /** The time of the last exchange of the pair. */
  at: number;
}

/**
 * The price of a pair at `now`: the stored price drifts back to the base
 * in a straight line and is at the base `driftHours` after the last
 * exchange. The part that is back is rounded down, so the price is never
 * above where the straight line puts it. A pair without a state is at the
 * base.
 */
export function priceNow(
  state: PriceState | undefined,
  now: number,
  driftHours: number,
): number {
  if (!state) return PRICE_UNIT;
  const span = BigInt(driftHours) * BigInt(HOUR_MS);
  const elapsed = BigInt(Math.max(0, now - state.at));
  if (elapsed >= span) return PRICE_UNIT;
  const back = (BigInt(PRICE_UNIT - state.price) * elapsed) / span; // rounded down
  return state.price + Number(back);
}

/**
 * The price after `given` units were given: it falls by a share of the
 * amount, price × 1,000,000 / (1,000,000 + step × given), rounded down. It
 * never reaches below 0 and never goes up, whatever the amount.
 */
export function priceAfter(price: number, given: number, step: number): number {
  const shift = BigInt(step) * BigInt(given);
  return Number(
    (BigInt(price) * BigInt(PRICE_UNIT)) / (BigInt(PRICE_UNIT) + shift),
  );
}

/** What an exchange needs of the planet, the round and the market. */
export interface Terms {
  /** The ratio of the pair, per `RATIO_UNIT` given. */
  ratio: number;
  /** The price of the pair now, in millionths of the base. */
  price: number;
  /** The fee in thousandths of the result. */
  fee: number;
}

const DIVISOR = BigInt(RATIO_UNIT) * BigInt(PRICE_UNIT) * BigInt(FEE_UNIT);

/** What `amount` gives at the terms, rounded down, with the fee; 0 for an amount of 0. */
export const got = (amount: number, t: Terms): number =>
  Number(
    (BigInt(amount) *
      BigInt(t.ratio) *
      BigInt(t.price) *
      BigInt(FEE_UNIT - t.fee)) /
      DIVISOR,
  );

/** What `amount` would give without the fee, rounded down; the difference is the fee. */
const gotWithoutFee = (amount: number, t: Terms): number =>
  Number(
    (BigInt(amount) * BigInt(t.ratio) * BigInt(t.price)) /
      (BigInt(RATIO_UNIT) * BigInt(PRICE_UNIT)),
  );

/**
 * The smallest amount that gives at least `want` at the terms; Infinity when
 * nothing gives anything (a price of 0).
 */
export function givingFor(want: number, t: Terms): number {
  const rate = BigInt(t.ratio) * BigInt(t.price) * BigInt(FEE_UNIT - t.fee);
  if (rate === 0n) return Infinity;
  return Number((BigInt(want) * DIVISOR + rate - 1n) / rate);
}

/** The free storage of a resource in whole units: the room under the limit, never below 0. */
export const roomFor = (stock: number, cap: number): number =>
  Math.floor(Math.max(0, cap - stock));

/** Why an exchange is refused, in the order of the checks. */
export type TradeError =
  | 'closed'
  | 'noPost'
  | 'resource'
  | 'amount'
  | 'poor'
  | 'full'
  | 'limit'
  | 'tiny';

/** The market as one player sees it on one planet. */
export interface Market {
  /** Whether the round has the marketplace on. */
  open: boolean;
  /** The level of the Handelsposten on the planet. */
  level: number;
  /** What the planet has, and the limits of its storage. */
  stock: Readonly<Resources>;
  caps: Readonly<Resources>;
  ratios: Readonly<Record<Pair, number>>;
  /** The price of every pair now. */
  prices: Readonly<Record<Pair, number>>;
  /** The amount the player gave today, and the limit per day. */
  used: number;
  limit: number;
}

/** What an exchange does. */
export interface Quote {
  pair: Pair;
  /** The amount given; below the amount asked when the free storage caps the result. */
  given: number;
  /** The amount got, after the fee. */
  got: number;
  /** The fee in the resource got: what the exchange would give without it, less `got`. */
  fee: number;
  /** Whether the free storage of the target capped the result. */
  capped: boolean;
}

/** The terms of a pair on the market. */
export const termsOf = (m: Market, pair: Pair): Terms => ({
  ratio: m.ratios[pair],
  price: m.prices[pair],
  fee: feeAt(m.level),
});

/** The amount the player may still give today. */
export const remaining = (m: Pick<Market, 'used' | 'limit'>): number =>
  Math.max(0, m.limit - m.used);

/** The checks of an exchange that need no price: the round, the post, the resources, the amount, the stock. */
function asked(
  m: Market,
  give: unknown,
  get: unknown,
  amount: unknown,
): { error: TradeError } | { pair: Pair; amount: number } {
  if (!m.open) return { error: 'closed' };
  if (m.level < 1) return { error: 'noPost' };
  const pair = pairOf(give, get);
  if (!pair) return { error: 'resource' };
  if (!Number.isSafeInteger(amount) || (amount as number) < 1)
    return { error: 'amount' };
  if ((amount as number) > Math.floor(m.stock[pair[0] as Res]))
    return { error: 'poor' };
  return { pair, amount: amount as number };
}

/**
 * The exchange of `amount` of `give` for `get`: the refusal, or what it does
 * (owner, 2026-11-17, D4). When the result would exceed the free storage
 * of `get`, it is capped to it and only the amount that gives it is taken.
 * The checks are in the order of `TradeError`; the server refuses with the
 * first and the browser shows the same.
 */
export function trade(
  m: Market,
  give: unknown,
  get: unknown,
  amount: unknown,
): { error: TradeError } | { quote: Quote } {
  const first = asked(m, give, get, amount);
  if ('error' in first) return first;
  const { pair } = first;
  const room = roomFor(m.stock[pair[1] as Res], m.caps[pair[1] as Res]);
  if (room < 1) return { error: 'full' };
  const terms = termsOf(m, pair);
  const all = got(first.amount, terms);
  const capped = all > room;
  const given = capped ? givingFor(room, terms) : first.amount;
  if (given > remaining(m)) return { error: 'limit' };
  const result = capped ? room : all;
  if (result < 1) return { error: 'tiny' };
  return {
    quote: {
      pair,
      given,
      got: result,
      fee: gotWithoutFee(given, terms) - got(given, terms),
      capped,
    },
  };
}

/**
 * The largest amount of `give` the player can give for `get` now: what the
 * planet has, what the limit of the day allows and what fills the free
 * storage of the target. 0 when nothing can be exchanged.
 */
export function maxGive(m: Market, give: Res, get: Res): number {
  const pair = pairOf(give, get);
  if (!pair || !m.open || m.level < 1) return 0;
  const room = roomFor(m.stock[get], m.caps[get]);
  if (room < 1) return 0;
  return Math.min(
    Math.floor(m.stock[give]),
    remaining(m),
    givingFor(room, termsOf(m, pair)),
  );
}
