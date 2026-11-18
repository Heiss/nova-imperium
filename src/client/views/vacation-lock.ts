// The lock screen of the vacation mode (#223, owner, 2026-11-18): a player
// in vacation mode sees it after the login instead of the game. It holds the
// notice, „Urlaubsmodus beenden“ (disabled, with its reason in the text
// next to it, until the minimum duration is over), „Logout“ and the account
// options: password, passkeys, push settings and deleting the account. The
// server sends no game to such a player (src/server/game/state.ts).
import { lockLeft, lockNote, locked } from '../logic/vacation.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { Ui } from './common.ts';
import { clearFrame } from './frame.ts';
import {
  deleteAccountBox,
  notificationBoxes,
  passkeysBox,
  passwordBox,
} from './misc.ts';

/**
 * The notice and the buttons. While the vacation cannot end yet the button
 * is disabled and the note says in how long it can: the reason stands in
 * text next to the button, which names it as its description.
 */
const endBox = (s: GameState, now: number): string => {
  const left = lockLeft(s, now);
  const wait = left > 0;
  const note = wait ? `<p id="lock-note">${lockNote(left)}</p>` : '';
  const end = `<button data-act="endVacation"${wait ? ' disabled aria-describedby="lock-note"' : ''}>Urlaubsmodus beenden</button>`;
  return `<div class="box"><div class="bd"><p>Dein Konto ist im Urlaubsmodus.</p>${note}<p>${end} <button type="button" data-act="logout">Logout</button></p></div></div>`;
};

/** The lock screen at `now`. */
export const lockHTML = (s: GameState, ui: Ui, now: number): string =>
  `<h2>Urlaubsmodus</h2>
 ${endBox(s, now)}
 ${passwordBox(ui)}
 ${passkeysBox()}
 ${notificationBoxes(s, ui)}
 ${deleteAccountBox(s.round)}`;

/** The clock of the open lock screen. */
let timer: ReturnType<typeof setInterval> | undefined;

/** Counts the note down and turns the button on when the minimum duration is over. */
function tick(view: HTMLElement, s: GameState): void {
  const note = view.querySelector('#lock-note');
  const button = view.querySelector('[data-act="endVacation"]');
  const left = lockLeft(s, client.now());
  if (note && button && left > 0) {
    note.textContent = lockNote(left);
    return;
  }
  clearInterval(timer);
  if (!note || !button) return;
  note.remove();
  button.removeAttribute('disabled');
  button.removeAttribute('aria-describedby');
}

/**
 * Shows the lock screen in `view` when the state is that of a player in
 * vacation mode, after `before` (which lets go of the mounted views), and
 * answers whether it did. Otherwise it leaves the view alone.
 */
export function renderLock(
  view: HTMLElement,
  s: GameState,
  ui: Ui,
  before: () => void,
): boolean {
  clearInterval(timer);
  if (!locked(s.me)) return false;
  before();
  client.forget();
  clearFrame();
  view.innerHTML = lockHTML(s, ui, client.now());
  if (lockLeft(s, client.now()) > 0)
    timer = setInterval(() => tick(view, s), 1000);
  return true;
}
