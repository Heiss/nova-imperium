// The marketplace on the server (#171, okf/features/marketplace.md): the
// exchange of one resource for another on the active planet, and the state
// the browser needs for its preview. The rules are those of src/core/market.ts
// (patterns, section 7); this file gathers the values, runs the exchange in
// the transaction of the action and says what happened. The price of a pair
// is shared by all players; what a player gave today is theirs.
import { caps } from '../../core/economy.ts';
import {
  type Market,
  type Pair,
  PAIRS,
  type Res,
  dayOf,
  marketOpen,
  postLevel,
  priceAfter,
  priceNow,
  priceWorse,
  ratiosOf,
  trade,
} from '../../core/market.ts';
import { priceChanged, tradeDone, tradeNote } from '../../core/market-text.ts';
import type { RoundRules } from '../../core/round.ts';
import type { Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import { type Handler, mine } from './actions.ts';
import { type Ctx, fail, universe } from './context.ts';
import { roundRules } from './round.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { StateShape } from '../../core/state/market.ts';

/** The price of every pair now, after the drift (millionths of the base). */
export function currentPrices(
  ctx: Ctx,
  round: Pick<RoundRules, 'marketDrift'> = roundRules(ctx),
): Record<Pair, number> {
  const stored = ctx.market.prices();
  return Object.fromEntries(
    PAIRS.map((pair) => [
      pair,
      priceNow(stored[pair], ctx.now(), round.marketDrift),
    ]),
  ) as Record<Pair, number>;
}

/** The market as the player sees it on the planet `p`, at this moment. */
export function marketOf(
  ctx: Ctx,
  u: User,
  p: Planet,
  round: RoundRules = roundRules(ctx),
): Market {
  return {
    open: marketOpen(round),
    level: postLevel(p),
    stock: p.res,
    caps: caps(p, universe(ctx)),
    ratios: ratiosOf(round),
    prices: currentPrices(ctx, round),
    used: ctx.market.used(u.id, dayOf(ctx.now())),
    limit: round.marketLimit,
    feeBase: round.marketFee,
    feeStep: round.marketFeeStep,
  };
}

/**
 * What the browser needs besides the round and the planet (#171): the price
 * of every pair now and what the player gave today. Its preview computes
 * the exchange with the same function as the server.
 */
const marketState = (ctx: Ctx, u: User) => ({
  prices: currentPrices(ctx),
  used: ctx.market.used(u.id, dayOf(ctx.now())),
});

/**
 * Exchanges `d.amount` of the resource `d.give` for `d.get` on the planet
 * `d.planet`. Everything runs in the transaction of the action: the stock,
 * the price of the pair and the amount of the day change together or not at
 * all. The audit entry records the planet, the pair, both amounts, the fee,
 * whether the storage capped it or the limit of the day cut it, and the price it was made at.
 */
const exchange: Handler<'trade'> = (ctx, u, d, event) => {
  const p = mine(ctx, u, d.planet);
  const round = roundRules(ctx);
  const market = marketOf(ctx, u, p, round);
  const result = trade(market, d.give, d.get, d.amount);
  if ('error' in result) return fail(tradeNote(result.error, market, d.get));
  // The price the player saw, before the own exchange moves it (#406): a
  // worse one now refuses, and nothing changes.
  const pair = result.quote.pair;
  if (priceWorse(d.price, market.prices[pair]))
    return fail(priceChanged(market, pair));
  const q = result.quote;
  const [give, get] = [q.pair[0] as Res, q.pair[1] as Res];
  p.res[give] -= q.given;
  p.res[get] += q.got;
  ctx.planets.save(p);
  const now = ctx.now();
  ctx.market.savePrice(q.pair, {
    price: priceAfter(market.prices[q.pair], q.given, round.marketStep),
    at: now,
  });
  ctx.market.addUsed(u.id, dayOf(now), q.given);
  if (event)
    event.detail = {
      planet: p.id,
      give,
      get,
      given: q.given,
      got: q.got,
      fee: q.fee,
      capped: q.capped,
      cut: q.cut,
      price: market.prices[q.pair],
    };
  return tradeDone(q);
};

export const serverFeature = {
  actions: { trade: exchange },
  state: {
    order: 180,
    keys: ['market'],
    // The prices of the marketplace and what the player gave today (#171).
    build: (ctx, u) => ({ market: marketState(ctx, u) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
