// The page „Optionen“ of a view state as markup, for the tests of the
// component Options (#118, bundle 5): rendered on the server side of Svelte,
// without its comments.
import { render } from 'svelte/server';
import { optionsPage } from '../client/logic/options.ts';
import type { V } from '../client/views/common.ts';
import Options from '../client/views/Options.svelte';
import { stripComments } from './markup.ts';

export const optionsView = (v: V): string =>
  stripComments(render(Options, { props: { page: optionsPage(v) } }).body);
