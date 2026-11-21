// The page „Marktplatz“ (#171, okf/features/marketplace.md) of the view
// state, as the component Market renders it (#118): the notice while the
// market is closed or the planet has no Handelsposten, else the form of the
// market; the fields of the form are the state of logic/market-form.svelte.ts
// (#332). The words are drafts [V] from the issue; the refusals are those of
// src/core/market-text.ts. The preview is MarketPreview.svelte (#337).
import type { Market } from '../../core/market.ts';
import { CLOSED, tradeNote } from '../../core/market-text.ts';
import type { V } from '../views/common.ts';
import { marketOf } from './market.ts';

/** What the page shows: a notice, or the form of the market of the shown planet. */
export type MarketPage =
  { kind: 'notice'; text: string } | { kind: 'form'; market: Market };

/** The page of the shown planet: the form while the market is open and the planet has a Handelsposten, else the reason. */
export function marketPage(v: V): MarketPage {
  const m = marketOf(v.s, v.P);
  if (!m?.open) return { kind: 'notice', text: CLOSED };
  if (m.level < 1)
    return {
      kind: 'notice',
      text: `${tradeNote('noPost', m, undefined)} Baue ihn unter „Gebäude“.`,
    };
  return { kind: 'form', market: m };
}
