// The page „Achievements“ of a view state as markup, for the tests of the
// component Achievements (#118, bundle 5): rendered on the server side of
// Svelte, without its comments.
import { render } from 'svelte/server';
import { achievementsPage } from '../client/logic/achievements.ts';
import type { V } from '../client/views/common.ts';
import Achievements from '../client/views/Achievements.svelte';
import { stripComments } from './markup.ts';

export const achievementsView = (v: V): string =>
  stripComments(
    render(Achievements, { props: { page: achievementsPage(v) } }).body,
  );
