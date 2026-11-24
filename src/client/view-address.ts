// Which view the address names and the address of a view (formerly in
// main.ts): the routing of the page, without a render.
import {
  addressParams,
  type AddressParams,
  namesOf,
  viewUrl,
} from './logic/address.ts';
import { hiddenView } from './logic/navigation.ts';
import { client } from './logic/state.svelte.ts';
import { MOUNTED } from './views/mount.ts';
import { ADDRESS, VIEWS } from './views/index.ts';

/** The view to show for the name: the overview for an unknown or hidden one. */
export function gameView(view: string | null): string {
  if (!view || (!MOUNTED.has(view) && !Object.hasOwn(VIEWS, view)))
    return 'overview';
  return hiddenView(view, client.game) ? 'overview' : view;
}

export const viewFromUrl = (): string =>
  gameView(new URLSearchParams(location.search).get('view'));

export const urlOf = (view: string, params: AddressParams = {}): string =>
  viewUrl(location.href, view, params, ADDRESS);

/** The parameters of `view` in the address of the page (#379). */
export const paramsFromUrl = (view: string): Record<string, string> =>
  addressParams(location.search, view, ADDRESS);

/** The parameters of `view` from their values in the order the view declares them (#379). */
export const paramsOf = (
  view: string,
  values: readonly (string | null | undefined)[],
): Record<string, string> =>
  Object.fromEntries(
    namesOf(ADDRESS, view).flatMap((name, i) => {
      const value = values[i];
      return value ? [[name, value]] : [];
    }),
  );

/** The values of the parameters of `view` in the order it declares them. */
export const valuesOf = (
  view: string,
  params: Readonly<Record<string, string>>,
): (string | null)[] =>
  namesOf(ADDRESS, view).map((name) => params[name] ?? null);
