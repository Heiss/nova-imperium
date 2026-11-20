// Which views are Svelte components and how each is mounted (#114, #118):
// main.ts mounts the view of the page through `mountView` and knows no view
// by name. No view is listed here (#317): each exports `clientViews` from its
// own module in this folder (contract.ts), and the list is generated.
import type { V } from './common.ts';
import { assembleMounts } from './assemble.ts';
import type { Mounted } from './contract.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

export type { Mounted };

const VIEWS = assembleMounts(CLIENT_VIEWS);
const MOUNT = VIEWS.mount;

/** The views that are Svelte components (the four lists too, each by its key). */
export const MOUNTED: ReadonlySet<string> = new Set(Object.keys(MOUNT));

/** The Svelte views mounted anew on every render, as their HTML was rendered anew (#118). */
export const ANEW: ReadonlySet<string> = VIEWS.anew;

/** Mounts the component of the view; any other view gets the overview. */
export function mountView(view: string, target: HTMLElement, v: V): Mounted {
  const name = Object.hasOwn(MOUNT, view) ? view : 'overview';
  return { view: name, ...MOUNT[name]!(target, v) };
}
