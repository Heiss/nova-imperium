import { mount, unmount } from 'svelte';
import type { CatalogKind } from '../logic/catalog-list.ts';
import CatalogList from './CatalogList.svelte';

/**
 * The list of a kind (#118), mounted once per view; it shows `client.shown`
 * of the state module and follows it.
 */
export function mountCatalogList(target: HTMLElement, kind: CatalogKind) {
  const component = mount(CatalogList, { target, props: { kind } });
  return { destroy: () => void unmount(component) };
}
