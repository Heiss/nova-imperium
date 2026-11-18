// The box „Urlaubsmodus“ in „Hilfe & Optionen“ (#223, okf/features/
// vacation-mode.md): outside of it the box explains the mode and what
// blocks the entry and offers „Urlaubsmodus aktivieren“; during it the box
// shows the earliest end, and „Urlaubsmodus beenden“ becomes active once
// the minimum duration of the round is over (owner, 2026-11-17). The rule
// of the end is the one of the server (src/core/vacation.ts). The
// Sternenkarte marks a player in vacation mode with „(u)“ (logic/galaxy.ts).
import { vacationEnd, vacationExitError } from '../../core/vacation.ts';
import { lockEnd } from './main-planet.ts';
import type { GameState } from './types.ts';

type VacationState = {
  me: Pick<GameState['me'], 'vacation'>;
  round: Pick<GameState['round'], 'vacationHours'>;
};

/** The earliest end as a date and a clock time of the browser. */
export const vacationEndText = lockEnd;

/** „1 Stunde“, „24 Stunden“. */
const hours = (n: number): string => `${n} ${n === 1 ? 'Stunde' : 'Stunden'}`;

/** The question before the start: it cannot end before the minimum duration. */
export const confirmText = (n: number): string =>
  `Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach ${hours(n)}.`;

/** The box outside of the vacation mode. */
const offHTML = (n: number): string =>
  `<p>Im Urlaubsmodus ruht die Produktion deiner Planeten und Monde, und du kannst nichts bauen, forschen oder Flotten senden. Andere Spieler können keine neuen Flotten zu dir schicken; bereits gestartete kommen noch an. Beenden kannst du ihn frühestens nach ${hours(n)}.</p><p>Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs sind und weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet wird.</p><button data-act="startVacation">Urlaubsmodus aktivieren</button>`;

/** The content of the box „Urlaubsmodus“ at `now`. */
export function vacationHTML(s: VacationState, now: number): string {
  const start = s.me.vacation;
  const n = s.round.vacationHours;
  if (start === null) return offHTML(n);
  const off = vacationExitError(start, n, now) ? ' disabled' : '';
  return `<p>Du bist im Urlaubsmodus.</p><p id="o_vacation_end">Frühestens beendbar am ${vacationEndText(vacationEnd(start, n))}</p><button data-act="endVacation"${off}>Urlaubsmodus beenden</button>`;
}
