// The box „Hauptplanet“ in „Optionen“ (#221, okf/features/main-planet.md): a
// selection of the own planets and „Ändern“; while the lock of the last
// switch holds, both are disabled and the box says when the choice is
// possible again. Moons are never offered. The component Options renders the
// box from `mainPlanetBox()` (#118, bundle 5).
import { mainLocked } from '../../core/main-planet.ts';
import { coords } from './format.ts';
import type { GameState } from './types.ts';

type MainState = Pick<
  GameState,
  'me' | 'galaxy' | 'round' | 'homePlanet' | 'mainPlanet' | 'mainLock'
>;

/** The end of the lock as a date and a clock time of the browser. */
export const lockEnd = (t: number): string =>
  new Date(t).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** „1 Tag“, „7 Tage“. */
const days = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;

/** One option per own planet. */
interface MainPlanetOption {
  id: string;
  /** The planet's name and place; the first planet keeps its name „Heimatplanet“ (D2). */
  label: string;
  selected: boolean;
}

/** The box „Hauptplanet“: its text, the choice and the note while the lock holds. */
export interface MainPlanetBox {
  intro: string;
  options: MainPlanetOption[];
  /** The selection and the button are disabled while the lock holds. */
  locked: boolean;
  /** „Wieder änderbar ab …“ while the lock holds, else none. */
  note: string | null;
}

/** One option per own planet; the first planet keeps its name „Heimatplanet“ (D2). */
function planetOptions(s: MainState): MainPlanetOption[] {
  return s.galaxy
    .filter((p) => p.owner === s.me.id && p.kind === 'planet')
    .map((p) => ({
      id: p.id,
      label: `${p.name} ${coords(p)}${p.id === s.homePlanet ? ' – Heimatplanet' : ''}`,
      selected: p.id === s.mainPlanet,
    }));
}

/** The box „Hauptplanet“ at `now`. */
export function mainPlanetBox(s: MainState, now: number): MainPlanetBox {
  const end = s.mainLock ?? null;
  const locked = mainLocked(end, now);
  return {
    intro: `Der Hauptplanet ist das Ziel von „zum Heimatsystem“ auf der Sternenkarte und der Planet, den das Spiel ohne Auswahl zeigt. Nach jedem Wechsel ist die Wahl ${days(s.round.mainLock)} gesperrt.`,
    options: planetOptions(s),
    locked,
    note: locked ? `Wieder änderbar ab ${lockEnd(end!)}` : null,
  };
}
