// The address of a view (`?view=…`) with the parameters the view declares
// (`address` of its `clientViews`, #379): a guild (`&guild=…`, #163), an
// article of the Lexicanum (`&a=…`, #285), so a link can be shared and
// „back“ works. Small on purpose: it is part of the start bundle, the
// Lexicanum itself loads on demand (#242); the table of the parameters is
// handed in.

/** The name of the view of the Lexicanum and of its article parameter. */
export const LEXICANUM_VIEW = 'lexicanum';
export const ARTICLE_PARAM = 'a';

/** The address parameters of the views that have some, by view key. */
export type AddressTable = Readonly<Record<string, readonly string[]>>;

/** The values of the address parameters of a view; a missing or empty one is left out. */
export type AddressParams = Readonly<Record<string, string | null | undefined>>;

/** The id of the article in an address; '' for the start page. */
export const articleParam = (search: string): string =>
  new URLSearchParams(search).get(ARTICLE_PARAM) ?? '';

/**
 * The address of a view from the current one: the parameters of `table`
 * only for their own view and only with a value, no hash.
 */
export function viewUrl(
  href: string,
  view: string,
  params: AddressParams,
  table: AddressTable,
): string {
  const url = new URL(href);
  url.searchParams.set('view', view);
  for (const [owner, names] of Object.entries(table))
    for (const name of names) {
      const value = owner === view ? params[name] : null;
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }
  // The hash is left out: only the path and the query are returned.
  return url.pathname + url.search;
}

/** The parameters of `view` in the query `search` that have a value. */
export function addressParams(
  search: string,
  view: string,
  table: AddressTable,
): Record<string, string> {
  // A view without parameters reads none.
  const names = table[view];
  if (!names) return {};
  const query = new URLSearchParams(search);
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = query.get(name);
      return value ? [[name, value]] : [];
    }),
  );
}

/** The relative address of an article, for the links of the Lexicanum. */
export const articleHref = (id: string): string =>
  `?view=${LEXICANUM_VIEW}${id ? `&${ARTICLE_PARAM}=${encodeURIComponent(id)}` : ''}`;

/**
 * The state URL of the planet, or of the main planet when none is named, and
 * the conversation of the private messages the browser has open, if it names
 * one: `pm` is the other player's name, `pmAfter` the newest message it holds
 * (Q32, #226).
 */
export const stateUrl = (
  planet?: string,
  open: { pm?: string; pmAfter?: number } = {},
): string => {
  const query = [
    ...(planet ? [`planet=${encodeURIComponent(planet)}`] : []),
    ...(open.pm !== undefined && open.pmAfter !== undefined
      ? [`pm=${encodeURIComponent(open.pm)}`, `pmAfter=${open.pmAfter}`]
      : []),
  ];
  return query.length ? `/api/state?${query.join('&')}` : '/api/state';
};
