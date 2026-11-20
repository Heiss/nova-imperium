// The buddy list of a view state as markup, for the tests of the component
// Friends (#118, bundle 7): rendered on the server side of Svelte, without
// its comments.
import { render } from 'svelte/server';
import { friendsPage } from '../client/logic/friends.ts';
import type { V } from '../client/views/common.ts';
import Friends from '../client/views/Friends.svelte';
import { stripComments } from './markup.ts';

/** The server side writes `value=""` for a field that shows an empty draft; no browser shows it. */
const EMPTY_DRAFT = 'autocomplete="off" value=""';

export const friendsView = (v: V): string =>
  stripComments(
    render(Friends, { props: { page: friendsPage(v) } }).body,
  ).replace(EMPTY_DRAFT, 'autocomplete="off"');
