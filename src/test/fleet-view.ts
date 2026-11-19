// The fleet view of a view state as markup, for the tests of the component
// Fleet (#118, bundle 3): rendered on the server side of Svelte, without its
// comments.
import { render } from 'svelte/server';
import { fleetPage } from '../client/logic/fleet.ts';
import type { V } from '../client/views/common.ts';
import Fleet from '../client/views/Fleet.svelte';
import { stripComments } from './markup.ts';

export const fleetView = (v: V): string =>
  stripComments(render(Fleet, { props: { page: fleetPage(v) } }).body);
