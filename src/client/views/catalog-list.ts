import { mount, unmount } from 'svelte';
import type { CatalogKind } from '../logic/catalog-list.ts';
import CatalogList from './CatalogList.svelte';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';

/**
 * The list of a kind (#118), mounted once per view; it shows `client.shown`
 * of the state module and follows it.
 */
function mountCatalogList(target: HTMLElement, kind: CatalogKind) {
  const component = mount(CatalogList, { target, props: { kind } });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'buildings',
    mount: (target) => mountCatalogList(target, 'building'),
    menu: { order: 20, label: 'Gebäude' },
    glyph: glyph(
      '<path d="M3 21h18M5 21V10l3-2V5h2v2l2-2 2 2V5h2v3l3 2v11"/><path d="M10 21v-5h4v5"/>',
    ),
    tab: { order: 20, label: 'Bauen' },
  },
  {
    key: 'research',
    mount: (target) => mountCatalogList(target, 'research'),
    menu: { order: 50, label: 'Forschung' },
  },
  {
    key: 'shipyard',
    mount: (target) => mountCatalogList(target, 'ship'),
    menu: { order: 60, label: 'Schiffsschmiede' },
  },
  {
    key: 'defense',
    mount: (target) => mountCatalogList(target, 'defense'),
    menu: { order: 70, label: 'Verteidigung' },
  },
] satisfies readonly ClientView[];
