import { type ComponentProps, mount, unmount } from 'svelte';
import {
  adminChatPage,
  dissolvePage,
  guildsPage,
  transferPage,
} from '../logic/guilds.ts';
import type { Dialog } from '../modal.ts';
import GuildDialogs from './GuildDialogs.svelte';
import Guilds from './Guilds.svelte';
import type { ClientView } from './contract.ts';
import { keptMount } from './kept.ts';

/**
 * „Gilden“ (#118, bundle 6), its data as a property. A fresh render mounts it
 * anew; any other render hands it the new page, so the fields of its forms
 * and the chat stay the same elements while the player types (#361). The
 * fields keep their state in `logic/guild-form.svelte.ts` (#332), and the
 * chat's place is kept by `keepChatScroll` (`features/guilds.ts`).
 */
const mountGuilds = keptMount(Guilds, guildsPage);

/** A dialog of the guilds as a component of the modal. */
const dialog =
  (props: ComponentProps<typeof GuildDialogs>): Dialog =>
  (target) => {
    const component = mount(GuildDialogs, { target, props });
    return () => void unmount(component);
  };

/** The hand-over: the Leitung chooses its own new rank (owner, 2026-11-14). */
export const transferDialog = (
  ...args: Parameters<typeof transferPage>
): Dialog => dialog({ dialog: { kind: 'transfer', ...transferPage(...args) } });

/** Dissolving the guild, confirmed with its tag (owner, 2026-11-14). */
export const dissolveDialog = (
  ...args: Parameters<typeof dissolvePage>
): Dialog => dialog({ dialog: { kind: 'dissolve', ...dissolvePage(...args) } });

/** The chat of a guild as the admin reads it (#169, D8). */
export const adminChatDialog = (
  ...args: Parameters<typeof adminChatPage>
): Dialog => dialog({ dialog: { kind: 'chat', ...adminChatPage(...args) } });

export const clientViews = [
  {
    key: 'guilds',
    mount: mountGuilds,
    // The guild the page shows (#163).
    address: ['guild'],
    fresh: true,
    // No guild view in a round with guilds off (#191).
    offered: (round) => round.guilds,
    menu: { order: 120, label: 'Gilden' },
  },
] satisfies readonly ClientView[];
