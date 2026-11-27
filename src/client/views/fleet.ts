import { incomingHint } from '../logic/menu-hints.ts';
import { fleetPage } from '../logic/fleet.ts';
import Fleet from './Fleet.svelte';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';
import { keptMount } from './kept.ts';

/**
 * The fleet view (#118, bundle 3), its data as a property. A fresh render
 * mounts it anew and drops the draft of the form; any other render hands it
 * the new page, so its fields stay the same elements while the player types
 * (#361). The form keeps its draft in logic/fleet-form.svelte.ts, and
 * features/fleet.ts fills the preview of the flight after each render.
 */
const mountFleet = keptMount(Fleet, fleetPage);

export const clientViews = [
  {
    key: 'fleet',
    hint: { mark: ({ state }) => incomingHint(state), join: true },
    mount: mountFleet,
    fresh: true,
    menu: { order: 80, label: 'Flotte', divider: true },
    glyph: glyph(
      '<path d="M3 12l7-3 11 3-11 3z"/><path d="M8 9.8L6 5l5 3.5M8 14.2L6 19l5-3.5"/>',
    ),
    tab: { order: 30 },
  },
] satisfies readonly ClientView[];
