// The notes that go away by themselves (formerly in main.ts). A refusal
// offers „Problem melden“ to a signed-in player (issue #126); the banner of a
// maintenance already says its text, so no note repeats it.
import { maintenanceText } from './maintenance.ts';
import { client } from './logic/state.svelte.ts';

function reportOffer(msg: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'small';
  button.textContent = 'Problem melden';
  Object.assign(button.dataset, {
    act: 'reportProblem',
    message: msg,
    page: client.ui.view,
    request: client.ui.lastRequestId ?? '',
  });
  return button;
}

export function toast(msg: string, err = false): void {
  if (msg === maintenanceText()) return;
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.setAttribute('role', err ? 'alert' : 'status');
  t.textContent = msg;
  // Signed-in players can report every error message (issue #126).
  const offer = err && client.game !== null;
  if (offer) t.append(reportOffer(msg));
  document.body.appendChild(t);
  setTimeout(() => t.remove(), offer ? 8000 : 3500);
}
