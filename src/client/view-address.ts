// Which view the address names and the address of a view (formerly in
// main.ts): the routing of the page, without a render.
import { viewUrl } from './logic/address.ts';
import { hiddenView } from './logic/navigation.ts';
import { client } from './logic/state.svelte.ts';
import { MOUNTED } from './views/mount.ts';
import { VIEWS } from './views/index.ts';

/** The view to show for the name: the overview for an unknown or hidden one. */
export function gameView(view: string | null): string {
  if (!view || (!MOUNTED.has(view) && !Object.hasOwn(VIEWS, view)))
    return 'overview';
  return hiddenView(view, client.game) ? 'overview' : view;
}

export const viewFromUrl = (): string =>
  gameView(new URLSearchParams(location.search).get('view'));

export const urlOf = (view: string, guild: string | null = null): string =>
  viewUrl(location.href, view, guild);
