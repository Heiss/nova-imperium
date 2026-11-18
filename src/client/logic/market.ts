// The marketplace in the browser (#171, okf/features/marketplace.md): the
// market of the shown planet from the state, the draft of the form, and the
// preview, which calls the same function as the server (`trade` of
// src/core/market.ts) and so shows its result, its fee and its cap. The
// words are drafts [V] for the owner to confirm, except the refusals, which
// the server and the browser take from src/core/market-text.ts.
import { caps } from '../../core/economy.ts';
import {
  DEFAULT_RATIOS,
  FEE_UNIT,
  type Market,
  type Pair,
  PAIRS,
  RATIO_UNIT,
  RES_NAME,
  type Res,
  TRADED,
  feeAt,
  gainingTrips,
  got,
  marketOpen,
  maxGive,
  pairOf,
  postLevel,
  ratiosOf,
  remaining,
  termsOf,
  trade,
} from '../../core/market.ts';
import { tradeNote } from '../../core/market-text.ts';
import type { Planet, Universe } from '../../core/types.ts';
import { fmt } from './format.ts';
import type { GameState } from './types.ts';

/** What the player chose in the form: the resources and the amount as typed. */
export interface Draft {
  give: Res;
  get: Res;
  amount: string;
}

/** The form starts with Adamant for Psikristall and no amount. */
export const newDraft = (): Draft => ({ give: 'm', get: 'c', amount: '' });

/** The draft of the open form; the view and its handlers share it. */
export const draft: Draft = newDraft();

/** The market of the shown planet from the state of the server; null before the server sent its prices. */
export function marketOf(s: GameState, p: Planet): Market | null {
  if (!s.market) return null;
  return {
    open: marketOpen(s.round),
    level: postLevel(p),
    stock: p.res,
    caps: caps(p, s.cfg),
    ratios: ratiosOf(s.round),
    prices: s.market.prices,
    used: s.market.used,
    limit: s.round.marketLimit,
  };
}

/** The resources that can be got for `give`: every traded one but `give`. */
export const targets = (give: Res): Res[] => TRADED.filter((r) => r !== give);

/** The draft with a resource to get that differs from the one given. */
export function fixed(d: Draft): Draft {
  return d.get === d.give ? { ...d, get: targets(d.give)[0]! } : d;
}

/** The amount typed, or null while the field is empty; a text that is no number is NaN. */
export const amountOf = (text: string): number | null =>
  text.trim() === '' ? null : Number(text);

/** A line of the preview. */
interface PreviewLine {
  label: string;
  value: string;
}

/** What the form shows below its fields. */
export interface Preview {
  lines: PreviewLine[];
  /** The refusal of the server for this amount, or that the storage caps it; null when neither. */
  note: string | null;
  /** Whether „Tauschen“ is offered: the server would take the exchange. */
  ok: boolean;
}

const percent = (fee: number): string => `${(fee * 100) / FEE_UNIT} %`;

/**
 * The preview of the draft on the market: the rate of the pair now, the
 * fee and what is left of the day; with an amount also what is given, what
 * is got and the fee in the resource got. Without an amount the rate is
 * what 1,000 give.
 */
export function preview(m: Market, d: Draft): Preview {
  const terms = termsOf(m, pairOf(d.give, d.get)!);
  const [give, get] = [RES_NAME[d.give], RES_NAME[d.get]];
  const rate: PreviewLine = {
    label: 'Kurs',
    value: `${fmt(got(RATIO_UNIT, terms))} ${get} je ${fmt(RATIO_UNIT)} ${give}`,
  };
  const today: PreviewLine = {
    label: 'Heute noch',
    value: `${fmt(remaining(m))} von ${fmt(m.limit)}`,
  };
  const fee = percent(feeAt(m.level));
  const amount = amountOf(d.amount);
  const result = amount === null ? null : trade(m, d.give, d.get, amount);
  if (!result || 'error' in result)
    return {
      lines: [rate, { label: 'Gebühr', value: fee }, today],
      note: result ? tradeNote(result.error, m, d.get) : null,
      ok: false,
    };
  const q = result.quote;
  return {
    lines: [
      { label: 'Du gibst', value: `${fmt(q.given)} ${give}` },
      { label: 'Du erhältst', value: `${fmt(q.got)} ${get}` },
      rate,
      { label: 'Gebühr', value: `${fmt(q.fee)} ${get} (${fee})` },
      today,
    ],
    note: q.capped
      ? `Begrenzt durch das freie Lager: Du gibst nur ${fmt(q.given)} ${give} ab.`
      : null,
    ok: true,
  };
}

/** The amount „max“ puts into the field: the most that can be given now, as text; empty when nothing can. */
export function maxAmount(m: Market, d: Draft): string {
  const most = maxGive(m, d.give, d.get);
  return most > 0 ? String(most) : '';
}

/**
 * The six ratios of the universe settings, by the keys of the round
 * (`roundMarketMc` for Adamant → Psikristall); a setting that is missing is
 * the default.
 */
const ratiosOfSettings = (cfg: Universe): Record<Pair, number> =>
  Object.fromEntries(
    PAIRS.map((pair) => [
      pair,
      cfg[`roundMarket${pair[0]!.toUpperCase()}${pair[1]}`] ??
        DEFAULT_RATIOS[pair],
    ]),
  ) as Record<Pair, number>;

/**
 * The warning of the admin panel (D2, owner, 2026-11-17) for the ratios of
 * the universe settings: every round trip that gains, as „Adamant →
 * Psikristall → Adamant“; null when none does. It is checked without the fee
 * of the Handelsposten, as the lowest fee is 0.
 */
export function gainWarning(cfg: Universe): string | null {
  const trips = gainingTrips(ratiosOfSettings(cfg)).map((trip) =>
    [...trip, trip[0]!].map((r) => RES_NAME[r]).join(' → '),
  );
  return trips.length === 0
    ? null
    : `Achtung: Ein Tausch im Kreis bringt selbst ohne Gebühr Gewinn: ${trips.join('; ')}. Bitte die Kurse anpassen.`;
}
