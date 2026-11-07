import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { V } from './common.ts';
import Buildings from './Buildings.svelte';

export function mountBuildings(target: HTMLElement, initial: V) {
  const viewState = writable(initial);
  const component = mount(Buildings, { target, props: { viewState } });
  return {
    update: viewState.set,
    destroy: () => void unmount(component),
  };
}
