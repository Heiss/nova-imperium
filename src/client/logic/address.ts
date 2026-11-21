// The address of a view (`?view=…`), of a guild (`&guild=…`, #163) and of an
// article of the Lexicanum (`&a=…`, #285), so a link can be shared and
// „back“ works. Small on purpose: it is part of the start bundle, the
// Lexicanum itself loads on demand (#242).

/** The name of the view of the Lexicanum and of its article parameter. */
export const LEXICANUM_VIEW = 'lexicanum';
const ARTICLE_PARAM = 'a';

/** The id of the article in an address; '' for the start page. */
export const articleParam = (search: string): string =>
  new URLSearchParams(search).get(ARTICLE_PARAM) ?? '';

/**
 * The address of a view from the current one: the guild only for the view
 * of the guilds, the article only for the Lexicanum, no hash.
 */
export function viewUrl(
  href: string,
  view: string,
  guild: string | null = null,
  article = '',
): string {
  const url = new URL(href);
  url.searchParams.set('view', view);
  if (view === 'guilds' && guild) url.searchParams.set('guild', guild);
  else url.searchParams.delete('guild');
  if (view === LEXICANUM_VIEW && article)
    url.searchParams.set(ARTICLE_PARAM, article);
  else url.searchParams.delete(ARTICLE_PARAM);
  // The hash is left out: only the path and the query are returned.
  return url.pathname + url.search;
}

/** The relative address of an article, for the links of the Lexicanum. */
export const articleHref = (id: string): string =>
  `?view=${LEXICANUM_VIEW}${id ? `&${ARTICLE_PARAM}=${encodeURIComponent(id)}` : ''}`;

/** The state URL of the planet, or of the main planet when none is named. */
export const stateUrl = (planet?: string): string =>
  planet ? `/api/state?planet=${encodeURIComponent(planet)}` : '/api/state';
