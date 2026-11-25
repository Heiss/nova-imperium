import { marketOpen } from '../../core/market.ts';
import { marketPage } from '../logic/market-page.ts';
import Market from './Market.svelte';
import type { ClientView } from './contract.ts';
import { keptMount } from './kept.ts';

/**
 * „Marktplatz“ (#118, bundle 7), its data as a property. A fresh render
 * mounts it anew; any other render hands it the new page, so the amount the
 * player types stays the same field (#361). The draft of the form lives in
 * logic/market-form.svelte.ts.
 */
const mountMarket = keptMount(Market, marketPage);

export const clientViews = [
  {
    key: 'market',
    mount: mountMarket,
    fresh: true,
    // Only in a round with the marketplace on: switched off, it is hidden,
    // not shown as closed (#404; owner, 2026-11-25, 112a).
    offered: marketOpen,
    menu: { order: 40, label: 'Marktplatz' },
  },
] satisfies readonly ClientView[];
