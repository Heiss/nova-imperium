// The box „Hauptplanet“ in „Hilfe & Optionen“ (#221, okf/features/
// main-planet.md): a selection of the own planets and „Ändern“; while the
// lock of the last switch holds, both are disabled and the box says when the
// choice is possible again. Moons are never offered.
import { mainLocked } from '../../core/main-planet.ts';
import { coords, esc } from './format.ts';
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

/** One option per own planet; the first planet keeps its name „Heimatplanet“ (D2). */
function planetOptions(s: MainState): string {
  return s.galaxy
    .filter((p) => p.owner === s.me.id && p.kind === 'planet')
    .map((p) => {
      const home = p.id === s.homePlanet ? ' – Heimatplanet' : '';
      const selected = p.id === s.mainPlanet ? ' selected' : '';
      return `<option value="${esc(p.id)}"${selected}>${esc(p.name)} ${coords(p)}${home}</option>`;
    })
    .join('');
}

/** The content of the box „Hauptplanet“ at `now`. */
export function mainPlanetHTML(s: MainState, now: number): string {
  const end = s.mainLock ?? null;
  const locked = mainLocked(end, now);
  const off = locked ? ' disabled' : '';
  const note = locked
    ? `<p id="o_main_lock">Wieder änderbar ab ${lockEnd(end!)}</p>`
    : '';
  return `<p>Der Hauptplanet ist das Ziel von „zum Heimatsystem“ auf der Sternenkarte und der Planet, den das Spiel ohne Auswahl zeigt. Nach jedem Wechsel ist die Wahl ${days(s.round.mainLock)} gesperrt.</p><div class="flex"><label for="o_main">Hauptplanet</label> <select id="o_main"${off}>${planetOptions(s)}</select> <button data-act="mainPlanet"${off}>Ändern</button></div>${note}`;
}
