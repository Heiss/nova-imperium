// The lock screen of the vacation mode (#223, owner, 2026-11-18): a player
// in vacation mode sees it after the login instead of the game. It holds the
// notice, „Urlaubsmodus beenden“ (disabled, with its reason in the text
// next to it, until the minimum duration is over), „Logout“ and the account
// options: password, passkeys, push settings and deleting the account, and
// since 2026-11-21 (owner, Q28) „Nachrichten“: the inbox with replying and
// the sent messages, no reports and nothing else of the interface. The
// server sends no game to such a player (src/server/game/state.ts).
import { mount, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { lockLeft, lockNote, locked } from '../logic/vacation.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { Ui, V } from './common.ts';
import { clearFrame } from './frame.ts';
import MessagesTabs from './MessagesTabs.svelte';
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

/** The place of „Nachrichten“ on the lock screen (Q28). */
const MESSAGES_HOST = 'lock-messages';

/** The lock screen at `now`. */
export const lockHTML = (s: GameState, ui: Ui, now: number): string =>
  `<h2>Urlaubsmodus</h2>
 ${endBox(s, now)}
 <div id="${MESSAGES_HOST}"></div>
 ${passwordBox(ui)}
 ${passkeysBox()}
 ${notificationBoxes(s, ui)}
 ${deleteAccountBox(s.round)}`;

/** „Nachrichten“ of the lock screen: mounted once, so the open conversation and what is typed stay over a render. */
let messages: {
  host: HTMLElement;
  state: Writable<Pick<V, 's'>>;
  destroy: () => void;
} | null = null;

/** Lets go of „Nachrichten“ of the lock screen (the vacation ended, or the player left). */
export function forgetLock(): void {
  messages?.destroy();
  messages = null;
}

/** Puts „Nachrichten“ in its place on the freshly set lock screen, with the state of this render. */
function showMessages(view: HTMLElement, s: GameState): void {
  const place = view.querySelector(`#${MESSAGES_HOST}`)!;
  if (!messages) {
    const host = document.createElement('div');
    host.id = MESSAGES_HOST;
    const state = writable<Pick<V, 's'>>({ s });
    const component = mount(MessagesTabs, {
      target: host,
      props: { viewState: state, lock: true },
    });
    messages = { host, state, destroy: () => void unmount(component) };
  }
  messages.state.set({ s });
  place.replaceWith(messages.host);
}

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

/** What a player without a planet sees. */
const NO_PLANET =
  '<div class="notice">Du hast keinen Planeten. Bitte den Admin, eine neue Runde zu starten.</div>';

/**
 * Shows what takes the place of the game in `view` and answers whether it
 * did, after `before` (which lets go of the mounted views): the lock screen
 * for the state of a player in vacation mode, the notice for a player
 * without a planet. Otherwise it leaves the view alone.
 */
export function renderGate(
  view: HTMLElement,
  s: GameState,
  ui: Ui,
  before: () => void,
): boolean {
  clearInterval(timer);
  if (!locked(s.me)) {
    forgetLock();
    if (s.planet) return false;
    client.view = null;
    before();
    view.innerHTML = NO_PLANET;
    return true;
  }
  before();
  client.forget();
  clearFrame();
  const focus = document.activeElement?.id;
  view.innerHTML = lockHTML(s, ui, client.now());
  showMessages(view, s);
  // A reply being typed keeps the focus over the render.
  if (focus) document.getElementById(focus)?.focus();
  if (lockLeft(s, client.now()) > 0)
    timer = setInterval(() => tick(view, s), 1000);
  return true;
}
