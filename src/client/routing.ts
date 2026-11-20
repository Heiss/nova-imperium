// Showing a view with its address (formerly in main.ts), and the back and
// forward buttons of the browser.
import { closeMore } from './dom.ts';
import { client } from './logic/state.svelte.ts';
import { render } from './render.ts';
import { gameView, urlOf, viewFromUrl } from './view-address.ts';

/** Shows a view with its address and renders it. */
export const go = (
  requested: string,
  push = true,
  guild: string | null = null,
): void => {
  const ui = client.ui;
  const view = gameView(requested);
  if (view !== ui.view || guild !== ui.guild) {
    client.completionNotices.clear();
    if (push) history.pushState(null, '', urlOf(view, guild));
  }
  client.completedMenu.delete(view);
  closeMore();
  ui.view = view;
  ui.guild = view === 'guilds' ? guild : null;
  render(true);
  window.scrollTo(0, 0);
};

/** The back and forward buttons show the view of the address, unless an invitation is open. */
export function routeHistory(inviteOpen: () => boolean): void {
  window.addEventListener('popstate', () => {
    if (!inviteOpen())
      go(
        viewFromUrl(),
        false,
        new URLSearchParams(location.search).get('guild'),
      );
  });
}
