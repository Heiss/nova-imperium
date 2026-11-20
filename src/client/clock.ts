// The clock of the page (formerly in main.ts): every second the countdowns
// and the resource bar move on, a view that is due is drawn again; every 4
// seconds, and when the tab comes back, the state is loaded.
import { dur } from './logic/format.ts';
import { viewDue } from './logic/jump-gate.ts';
import { client } from './logic/state.svelte.ts';
import { listMounted, render, updateBar } from './render.ts';
import { refresh } from './sync.ts';

const TICK_MS = 1000;
const POLL_MS = 4000;

function tick(): void {
  if (!client.view) return;
  const now = client.now();
  if (viewDue(client.view, now)) {
    render();
    void refresh();
    return;
  }
  let due = false;
  // A list counts its own countdowns down (#118).
  const list = listMounted();
  document
    .querySelectorAll<HTMLElement>(list ? '.cd:not(#view *)' : '.cd')
    .forEach((el) => {
      const left = Number(el.dataset.end) - now;
      if (left > 0) return void (el.textContent = dur(left));
      if (!el.dataset.fired) {
        el.dataset.fired = '1';
        due = true;
      }
      el.textContent = 'fertig';
    });
  const planet = updateBar();
  // The list shows the planet moved to now: costs, buttons, maxima, countdowns.
  if (planet && list) client.shown = { ...client.view, P: planet, now };
  if (due) setTimeout(() => void refresh(), 1500);
}

export function startClock(): void {
  setInterval(tick, TICK_MS);
  setInterval(() => {
    if (client.game && !document.hidden) void refresh();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && client.game) void refresh();
  });
}
