// Going to an article of the Lexicanum and closing its side panel (#285):
// used by the actions of src/client/views/lexicanum.ts and by the
// components of the Lexicanum, which load on demand. Part of the start
// bundle.
import { ARTICLE_PARAM, LEXICANUM_VIEW } from '../logic/address.ts';
import { client } from '../logic/state.svelte.ts';
import { lex } from './lexicanum-state.svelte.ts';

type Go = (view: string, push?: boolean) => void;
/** The address of a view with its parameters (view-address.ts, #379). */
type Url = (view: string, params: Record<string, string>) => string;
let go: Go = () => undefined;
let url: Url = () => '';

/** Sets the navigation of main.ts that renders a view, and the address of a view. */
export const useNavigation = (navigate: Go, address: Url): void => {
  go = navigate;
  url = address;
};

/** Renders a view through main.ts. */
export const goTo = (view: string): void => go(view);

/** Marks the „?“ of the entry the panel shows, so the list updates it. */
export function markOpen(key: string | null): void {
  client.ui.openEx = key ? { [key]: true } : {};
  if (client.shown) client.shown = { ...client.shown };
}

/** Closes the side panel; the focus goes back to the „?“ that opened it. */
export function closePanel(focus = true): void {
  const key = lex.opener;
  if (!lex.panel) return;
  lex.panel = null;
  lex.opener = null;
  markOpen(null);
  if (focus && key) document.getElementById(`exq_${key}`)?.focus();
}

/** Opens an article on the page of the Lexicanum, with its address. */
export function openArticle(id: string): void {
  closePanel(false);
  history.pushState(null, '', url(LEXICANUM_VIEW, { [ARTICLE_PARAM]: id }));
  go(LEXICANUM_VIEW, false);
}
