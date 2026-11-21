// The row of the time at the target in the fleet form (#55, #93): the stay
// of an expedition, the holding time of a Halten, nothing for the other
// missions. The component Fleet (#118) renders the row from the choices of
// logic/fleet-choice.ts (#332); here are the words of it.
import { staysByUniverseSpeed, stayDuration } from '../../core/expedition.ts';
import type { Universe } from '../../core/types.ts';
import { dur } from './format.ts';

/** „1 Stunde“, „2 Stunden“. */
export const hoursLabel = (h: number): string =>
  h === 1 ? '1 Stunde' : `${h} Stunden`;

/** The real time of a stay of `hours` when the universe speed divides it (#93, owner, 2026-11-19) [V]; nothing otherwise. */
export const realStay = (hours: number, u: Universe): string =>
  staysByUniverseSpeed(u) && hours >= 1
    ? `entspricht ${dur(stayDuration(hours, u))} (durch Tempo ${u.speed} geteilt)`
    : '';
