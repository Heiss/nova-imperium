import { mount, unmount } from 'svelte';
import { friendsPage } from '../logic/friends.ts';
import type { V } from './common.ts';
import Friends from './Friends.svelte';
import type { ClientView } from './contract.ts';

/**
 * „Freunde“ (#118, bundle 7), its data as a property. It is mounted anew on
 * every render, as the HTML view was rendered anew: main.ts keeps the typed
 * name and the focus by id, and features/social.ts sends the actions.
 */
function mountFriends(target: HTMLElement, v: V) {
  const component = mount(Friends, {
    target,
    props: { page: friendsPage(v) },
  });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'friends',
    mount: mountFriends,
    anew: true,
    menu: { order: 130, label: 'Freunde' },
  },
] satisfies readonly ClientView[];
