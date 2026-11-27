import { friendsHint, friendsPage } from '../logic/friends.ts';
import Friends from './Friends.svelte';
import type { ClientView } from './contract.ts';
import { keptMount } from './kept.ts';

/**
 * „Freunde“ (#118, bundle 7), its data as a property. A fresh render mounts
 * it anew; any other render hands it the new page, so the name the player
 * types stays the same field (#361).
 */
const mountFriends = keptMount(Friends, friendsPage);

export const clientViews = [
  {
    key: 'friends',
    hint: ({ state }) => friendsHint(state),
    mount: mountFriends,
    fresh: true,
    menu: { order: 130, label: 'Freunde' },
  },
] satisfies readonly ClientView[];
