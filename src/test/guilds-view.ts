// The guild pages and dialogs as markup, for the tests of the components
// (#118, bundle 6): rendered on the server side of Svelte, without its
// comments.
import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import {
  adminChatPage,
  dissolvePage,
  guildsPage,
  transferPage,
} from '../client/logic/guilds.ts';
import type { V } from '../client/views/common.ts';
import GuildDialogs from '../client/views/GuildDialogs.svelte';
import Guilds from '../client/views/Guilds.svelte';
import { stripComments } from './markup.ts';

export const guildsView = (v: V): string =>
  stripComments(render(Guilds, { props: { page: guildsPage(v) } }).body);

const dialog = (props: ComponentProps<typeof GuildDialogs>): string =>
  stripComments(render(GuildDialogs, { props }).body);

export const transferDialogView = (
  ...args: Parameters<typeof transferPage>
): string => dialog({ dialog: { kind: 'transfer', ...transferPage(...args) } });

export const dissolveDialogView = (
  ...args: Parameters<typeof dissolvePage>
): string => dialog({ dialog: { kind: 'dissolve', ...dissolvePage(...args) } });

export const adminChatDialogView = (
  ...args: Parameters<typeof adminChatPage>
): string => dialog({ dialog: { kind: 'chat', ...adminChatPage(...args) } });
