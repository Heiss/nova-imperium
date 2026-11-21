// The position typed into the two fields of the Sternenkarte (#332): the
// state of the form. A field that nobody typed in (null) shows the position
// of the page; what was typed stays over a redraw until „Anzeigen“, Enter or
// an arrow draws the page anew (a fresh render drops it,
// form-state.svelte.ts).
import { clampInt } from './format.ts';
import { formState } from './form-state.svelte.ts';

export interface GalaxyPosition {
  /** The galaxy as typed, or null while the field shows the page. */
  gal: string | null;
  /** The system as typed, or null while the field shows the page. */
  sys: string | null;
}

export const galaxyPosition = formState((): GalaxyPosition => ({
  gal: null,
  sys: null,
}));

/** What a field shows: what was typed, else the position of the page. */
export const shown = (typed: string | null, page: number): string =>
  typed ?? String(page);

/** The galaxy and the system the player asks for, kept inside the universe. */
export function wanted(
  position: GalaxyPosition,
  page: { gal: number; sys: number },
  universe: { galaxies: number; systems: number },
): { gal: number; sys: number } {
  return {
    gal: clampInt(shown(position.gal, page.gal), 1, universe.galaxies),
    sys: clampInt(shown(position.sys, page.sys), 1, universe.systems),
  };
}
