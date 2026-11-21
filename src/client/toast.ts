// The notes that go away by themselves (formerly in main.ts). A refusal
// offers „Problem melden“ to a signed-in player (issue #126); the banner of a
// maintenance already says its text, so no note repeats it.
import { maintenanceText } from './maintenance.ts';
import { client } from './logic/state.svelte.ts';
import { requestIdOf } from './logic/transport.ts';

/**
 * The button „Problem melden“ of an error message. It names the call the
 * error comes from (its id travels with the error), never the last answer of
 * any call: the poll or another call may have answered meanwhile; a message
 * of the page itself names none.
 */
function reportOffer(msg: string, request: string | null): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'small';
  button.textContent = 'Problem melden';
  Object.assign(button.dataset, {
    act: 'reportProblem',
    message: msg,
    page: client.ui.view,
    request: request ?? '',
  });
  return button;
}

/**
 * Shows a note; `err` is true for an error message, or the error itself, so
 * that „Problem melden“ names the call it comes from.
 */
export function toast(msg: string, err: boolean | Error = false): void {
  if (msg === maintenanceText()) return;
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.setAttribute('role', err ? 'alert' : 'status');
  t.textContent = msg;
  // Signed-in players can report every error message (issue #126).
  const offer = err !== false && client.game !== null;
  if (offer) t.append(reportOffer(msg, requestIdOf(err)));
  document.body.appendChild(t);
  setTimeout(() => t.remove(), offer ? 8000 : 3500);
}
