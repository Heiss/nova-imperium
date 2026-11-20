// The marketplace of a view state as markup, for the tests of the component
// Market (#118, bundle 7): rendered on the server side of Svelte, without its
// comments.
import { render } from 'svelte/server';
import { marketPage } from '../client/logic/market-page.ts';
import type { V } from '../client/views/common.ts';
import Market from '../client/views/Market.svelte';
import { stripComments } from './markup.ts';

export const marketView = (v: V): string =>
  stripComments(render(Market, { props: { page: marketPage(v) } }).body);
