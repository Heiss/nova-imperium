// Every address of today opens the same place as before (#379): the same
// table ran against the code before the address parameters were declared per
// view (with its viewUrl(href, view, guild, article)) and after.
import { describe, expect, it } from 'vitest';
import { ADDRESS } from '../views/index.ts';
import { addressParams, viewUrl } from './address.ts';

/** The address of `view` from `href` with a guild and an article, as before. */
const url = (
  href: string,
  view: string,
  guild: string | null,
  article: string,
) => viewUrl(href, view, { guild, a: article }, ADDRESS);

const BASE = 'https://nova.example/';
/** [from, view, guild, article, the address]. */
const TODAY: readonly (readonly [
  string,
  string,
  string | null,
  string,
  string,
])[] = [
  [BASE, 'overview', null, '', '/?view=overview'],
  [BASE, 'guilds', null, '', '/?view=guilds'],
  [BASE, 'guilds', 'g1', '', '/?view=guilds&guild=g1'],
  [BASE, 'guilds', 'g 1&x', '', '/?view=guilds&guild=g+1%26x'],
  [BASE, 'lexicanum', null, '', '/?view=lexicanum'],
  [BASE, 'lexicanum', null, 'spy', '/?view=lexicanum&a=spy'],
  // Dropped: a parameter on a view that does not declare it.
  [BASE, 'buildings', 'g1', 'spy', '/?view=buildings'],
  [BASE, 'guilds', 'g1', 'spy', '/?view=guilds&guild=g1'],
  [BASE, 'lexicanum', 'g1', 'spy', '/?view=lexicanum&a=spy'],
  // Dropped from the address before: the other view's parameter and the hash.
  [
    `${BASE}?view=guilds&guild=g1#invite=x`,
    'lexicanum',
    null,
    'spy',
    '/?view=lexicanum&a=spy',
  ],
  [
    `${BASE}?view=lexicanum&a=spy`,
    'guilds',
    'g2',
    '',
    '/?view=guilds&guild=g2',
  ],
  [`${BASE}?view=lexicanum&a=spy`, 'lexicanum', null, '', '/?view=lexicanum'],
  [`${BASE}?view=guilds&guild=g1`, 'guilds', null, '', '/?view=guilds'],
  [`${BASE}?view=guilds&guild=g1`, 'overview', null, '', '/?view=overview'],
  // Kept: a parameter of nobody, the path.
  [
    `${BASE}x/?view=help&other=1`,
    'guilds',
    'g1',
    '',
    '/x/?view=guilds&other=1&guild=g1',
  ],
];

describe('the addresses of today (#379)', () => {
  it('are the same as before', () => {
    for (const [from, view, guild, article, address] of TODAY)
      expect(url(from, view, guild, article), `${from} ${view}`).toBe(address);
  });

  it('read back the parameters of their own view only', () => {
    const search = '?view=guilds&guild=g1&a=spy';
    expect(addressParams(search, 'guilds', ADDRESS)).toEqual({ guild: 'g1' });
    expect(addressParams(search, 'lexicanum', ADDRESS)).toEqual({ a: 'spy' });
    expect(addressParams(search, 'overview', ADDRESS)).toEqual({});
    expect(addressParams('?view=guilds&guild=', 'guilds', ADDRESS)).toEqual({});
  });
});
