// The header line of the game (#118, bundle 1; okf/architecture/patterns.md,
// section 9): the shown planet or moon, the commander, „Logout“ and, with
// more than one own place, the list „Aktiver Planet“. Pure, so the
// component Header.svelte only renders what this module computes.
import { placeName } from '../../core/moon.ts';
import type { Planet } from '../../core/types.ts';
import { coords } from './format.ts';
import { ownPlaces } from './moon.ts';
import type { GameState } from './types.ts';

/** One own planet or moon in the list „Aktiver Planet“. */
interface PlaceOption {
  id: string;
  /** Name and position, as the option shows them. */
  label: string;
  selected: boolean;
}

export interface HeaderLine {
  /** The name of the shown place, a moon with „(Mond)“. */
  name: string;
  position: string;
  commander: string;
  /** Every own planet and moon, each moon after its planet (#53); empty with only one. */
  places: PlaceOption[];
}

/** The header line of the shown place `P` (#118). */
export function headerLine(s: GameState, P: Planet): HeaderLine {
  const owned = ownPlaces(s.galaxy, s.me.id);
  return {
    name: placeName(P),
    position: coords(P),
    commander: s.me.name,
    places:
      owned.length > 1
        ? owned.map((p) => ({
            id: p.id,
            label: `${placeName(p)} ${coords(p)}`,
            selected: p.id === P.id,
          }))
        : [],
  };
}
