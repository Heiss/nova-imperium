import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { V } from './common.ts';
import ProducerTable from './ProducerTable.svelte';
import type { ClientView } from './contract.ts';

/** The resources page (#114), mounted like the buildings. */
function mountProducerTable(target: HTMLElement, initial: V) {
  const viewState = writable(initial);
  const component = mount(ProducerTable, { target, props: { viewState } });
  return {
    update: viewState.set,
    destroy: () => void unmount(component),
  };
}

export const clientViews = [
  {
    key: 'resources',
    mount: mountProducerTable,
    menu: { order: 30, label: 'Rohstoffe' },
  },
] satisfies readonly ClientView[];
