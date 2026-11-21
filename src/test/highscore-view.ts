// The highscore of a view state as markup, for the tests of the component
// Highscore (#118, bundle 5): rendered on the server side of Svelte, without
// its comments.
import { render } from 'svelte/server';
import { highscorePage } from '../client/logic/highscore.ts';
import type { V } from '../client/views/common.ts';
import Highscore from '../client/views/Highscore.svelte';
import { stripComments } from './markup.ts';

export const highscoreView = (v: V): string =>
  stripComments(render(Highscore, { props: { page: highscorePage(v) } }).body);
