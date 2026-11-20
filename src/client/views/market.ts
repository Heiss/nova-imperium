import { mount, unmount } from 'svelte';
import { marketPage } from '../logic/market-page.ts';
import type { V } from './common.ts';
import Market from './Market.svelte';

/**
 * „Marktplatz“ (#118, bundle 7), its data as a property. It is mounted anew
 * on every render, as the HTML view was rendered anew: the draft of the form
 * (`draft` of logic/market.ts) and main.ts, which keeps the typed values and
 * the focus by id, fill the fields, and features/market.ts repaints the
 * preview while the player types.
 */
export function mountMarket(target: HTMLElement, v: V) {
  const component = mount(Market, {
    target,
    props: { page: marketPage(v) },
  });
  return { destroy: () => void unmount(component) };
}
