// The name of a planet or moon (#214, patterns section 7): the action
// `rename` cleans the name it gets and cuts it to MAX_PLANET_NAME, then asks
// `planetNameError`. The server words the refusal (`RENAME_ERROR` in
// `server/game/actions.ts`); the dialog „umbenennen“ cuts with `maxlength`
// and sends nothing while the check refuses, without a note.

/** Longest name of a planet or moon; a longer one is cut, not refused. */
export const MAX_PLANET_NAME = 20;

/** Why a name cannot be taken. */
export type PlanetNameError = 'empty';

/** Why the name cannot be taken, or null; the name is cleaned and cut already. */
export const planetNameError = (name: string): PlanetNameError | null =>
  name ? null : 'empty';
