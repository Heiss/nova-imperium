import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { V } from './common.ts';
import ProducerTable from './ProducerTable.svelte';

/** The resources page (#114), mounted like the buildings. */
export function mountProducerTable(target: HTMLElement, initial: V) {
  const viewState = writable(initial);
  const component = mount(ProducerTable, { target, props: { viewState } });
  return {
    update: viewState.set,
    destroy: () => void unmount(component),
  };
}
