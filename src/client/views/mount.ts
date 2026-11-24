// Which views are Svelte components and how each is mounted (#114, #118):
// main.ts mounts the view of the page through `mountView` and knows no view
// by name. No view is listed here (#317): each exports `clientViews` from its
// own module in this folder (contract.ts), and the list is generated.
import type { V } from './common.ts';
import { assembleMounts } from './assemble.ts';
import type { Mounted } from './contract.ts';
import { offered } from './offered.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

export type { Mounted };

const VIEWS = assembleMounts(CLIENT_VIEWS);
const MOUNT = VIEWS.mount;

/** The views that are Svelte components (the four lists too, each by its key). */
export const MOUNTED: ReadonlySet<string> = new Set(Object.keys(MOUNT));

/** The Svelte views mounted anew on every render, as their HTML was rendered anew (#118). */
export const ANEW: ReadonlySet<string> = VIEWS.anew;

/** The Svelte views mounted anew by a fresh render only, kept by any other (#352). */
export const FRESH: ReadonlySet<string> = VIEWS.fresh;

/**
 * Whether a render mounts `view` anew instead of updating it: a view that
 * says `anew` always; on a fresh render a list of a catalog kind (`list`) and
 * a view that says `fresh` too.
 */
export const mountsAnew = (
  view: string,
  fresh: boolean,
  list: boolean,
): boolean => ANEW.has(view) || (fresh && (list || FRESH.has(view)));

/** Mounts the component of the view; any other view, or one not offered (#373), gets the overview. */
export function mountView(view: string, target: HTMLElement, v: V): Mounted {
  const name =
    Object.hasOwn(MOUNT, view) && offered(view, v.s.round, v.s.me.admin)
      ? view
      : 'overview';
  return { view: name, ...MOUNT[name]!(target, v) };
}
