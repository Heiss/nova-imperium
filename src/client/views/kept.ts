// The mount of a view that says `fresh` (#352, #361): a fresh render mounts it
// anew, any other render hands it the new page (`update`), so its fields stay
// the same elements. Used by the views with fields a player types into.
import { type Component, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { V } from './common.ts';
import type { Mount } from './contract.ts';
import KeptView from './KeptView.svelte';

/** Mounts `view` with the page of the view state and keeps it up to date. */
export function keptMount<P>(
  view: Component<{ page: P }>,
  pageOf: (v: V) => P,
): Mount {
  return (target, v) => {
    const page = writable(pageOf(v));
    const component = mount(KeptView<P>, { target, props: { view, page } });
    return {
      update: (next: V) => page.set(pageOf(next)),
      destroy: () => void unmount(component),
    };
  };
}
