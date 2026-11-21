// The list of reports of a view state as markup, for the tests of the
// component Messages (#118, bundle 4): rendered on the server side of Svelte,
// without its comments.
import { render } from 'svelte/server';
import { messagesPage } from '../client/logic/messages.ts';
import type { V } from '../client/views/common.ts';
import Messages from '../client/views/Messages.svelte';
import { stripComments } from './markup.ts';

export const messagesView = (v: V): string =>
  stripComments(render(Messages, { props: { page: messagesPage(v) } }).body);
