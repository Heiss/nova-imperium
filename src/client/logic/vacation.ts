// The vacation mode in the browser (#223, okf/features/vacation-mode.md).
// Outside of it the box „Urlaubsmodus“ in „Hilfe & Optionen“ explains the
// mode and what blocks the entry and offers „Urlaubsmodus aktivieren“.
// During it the player sees only the lock screen (owner, 2026-11-18): its
// texts and the time left until „Urlaubsmodus beenden“ becomes active. The
// rule of the end is the one of the server (src/core/vacation.ts). The
// Sternenkarte marks a player in vacation mode with „(u)“ (logic/galaxy.ts).
import { vacationEnd } from '../../core/vacation.ts';
import { dur } from './format.ts';
import type { GameState } from './types.ts';

/** What the lock screen needs of the state: the start and the minimum duration. */
export type LockState = {
  me: Pick<GameState['me'], 'vacation'>;
  round: Pick<GameState['round'], 'vacationHours'>;
};

/** „1 Stunde“, „24 Stunden“. */
const hours = (n: number): string => `${n} ${n === 1 ? 'Stunde' : 'Stunden'}`;

/** The question before the start: it cannot end before the minimum duration. */
export const confirmText = (n: number): string =>
  `Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach ${hours(n)}.`;

/** The first paragraph of the box outside of the vacation mode, for the minimum duration `n` in hours. */
export const vacationIntro = (n: number): string =>
  `Im Urlaubsmodus ruht die Produktion deiner Planeten und Monde, und du kannst nichts bauen, forschen oder Flotten senden. Andere Spieler können keine neuen Flotten zu dir schicken; bereits gestartete kommen noch an. Beenden kannst du ihn frühestens nach ${hours(n)}.`;

/** Whether the state shows the lock screen: the player is in vacation mode. */
export const locked = (me: Pick<GameState['me'], 'vacation'>): boolean =>
  me.vacation !== null;

/** How long the vacation must still last at `now`, in milliseconds; 0 once it can end. */
export function lockLeft(s: LockState, now: number): number {
  const start = s.me.vacation;
  if (start === null) return 0;
  return Math.max(0, vacationEnd(start, s.round.vacationHours) - now);
}

/** The notice below the button while the vacation cannot end yet (owner, 2026-11-18). */
export const lockNote = (left: number): string =>
  `Du kannst den Urlaubsmodus in ${dur(left)} beenden.`;
