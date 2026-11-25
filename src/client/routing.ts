// Showing a view with its address (formerly in main.ts), and the back and
// forward buttons of the browser.
import { closeMore } from './dom.ts';
import { client } from './logic/state.svelte.ts';
import { render } from './render.ts';
import {
  gameView,
  paramsFromUrl,
  paramsOf,
  urlOf,
  valuesOf,
  viewFromUrl,
} from './view-address.ts';

/** Whether two sets of address parameters are the same. */
const sameParams = (
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): boolean =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([name, value]) => b[name] === value);

/**
 * Shows a view with its address and renders it; `values` are the values of
 * the view's address parameters in the order it declares them (#379).
 */
export const go = (
  requested: string,
  push = true,
  ...values: (string | null | undefined)[]
): void => {
  const ui = client.ui;
  const view = gameView(requested);
  const params = paramsOf(view, values);
  if (view !== ui.view || !sameParams(params, ui.params)) {
    client.completionNotices.clear();
    if (push) history.pushState(null, '', urlOf(view, params));
  }
  client.completedMenu.delete(view);
  closeMore();
  ui.view = view;
  ui.params = params;
  render(true);
  window.scrollTo(0, 0);
};

/** The back and forward buttons show the view of the address, unless an invitation is open. */
export function routeHistory(inviteOpen: () => boolean): void {
  window.addEventListener('popstate', () => {
    if (!inviteOpen()) {
      const view = viewFromUrl();
      go(view, false, ...valuesOf(view, paramsFromUrl(view)));
    }
  });
}
