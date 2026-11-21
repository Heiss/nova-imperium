import { type ComponentProps, mount, unmount } from 'svelte';
import {
  adminChatPage,
  dissolvePage,
  guildsPage,
  transferPage,
} from '../logic/guilds.ts';
import type { Dialog } from '../modal.ts';
import type { V } from './common.ts';
import GuildDialogs from './GuildDialogs.svelte';
import Guilds from './Guilds.svelte';
import type { ClientView } from './contract.ts';

/**
 * „Gilden“ (#118, bundle 6), its data as a property. It is mounted anew on
 * every render, as the HTML view was rendered anew: `keepInputs`, the chat's
 * place (`keepChatScroll`) and the ticked rights of a rank are kept by main.ts
 * on the page, as before.
 */
function mountGuilds(target: HTMLElement, v: V) {
  const component = mount(Guilds, { target, props: { page: guildsPage(v) } });
  return { destroy: () => void unmount(component) };
}

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
    anew: true,
    menu: { order: 120, label: 'Gilden', show: (round) => round.guilds },
  },
] satisfies readonly ClientView[];
