// The system the Sternenkarte shows, for the requests of the state and the
// actions (151a): only while the map is the view, so nothing is computed
// for the noob protection elsewhere (core/galaxy-shown.ts).
import { shownParam } from '../../core/galaxy-shown.ts';
import { client } from './state.svelte.ts';

/** The view of the Sternenkarte. */
export const GALAXY_VIEW = 'galaxy';

/** `galaxy=g:s` while the Sternenkarte is shown, else nothing. */
export const shownQuery = (): { galaxy?: string } =>
  client.game && client.ui.view === GALAXY_VIEW
    ? { galaxy: shownParam({ g: client.ui.gal, s: client.ui.sys }) }
    : {};
