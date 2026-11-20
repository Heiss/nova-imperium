// What finished since the last render (formerly in main.ts): an upgrade, a
// research, an order of the shipyard or the return of a fleet marks the menu
// and shows a notice above the view.
import * as demolition from './logic/demolition.ts';
import { finishedYardOrders } from './logic/menu-hints.ts';
import { client } from './logic/state.svelte.ts';
import type { V } from './views/common.ts';

/** Remembers what finished between the two view states. */
export function rememberCompletions(previous: V, next: V): void {
  if (previous.P.id !== next.P.id) return;
  demolition.rememberUpgrade(
    client,
    previous.P.bq,
    next.P.b,
    'buildings',
    'Ausbau fertig',
    next.now,
  );
  demolition.rememberUpgrade(
    client,
    previous.R.rq,
    next.R.research,
    'research',
    'Forschung fertig',
    next.now,
  );
  for (const view of finishedYardOrders(previous.P, next.now)) {
    client.completedMenu.set(view, 'Auftrag der Schiffsschmiede fertig');
    client.completionNotices.add('Auftrag der Schiffsschmiede fertig.');
  }
  rememberFleetReturn(previous, next);
}

function rememberFleetReturn(previous: V, next: V): void {
  const live = new Set(next.s.fleets.map((fleet) => fleet.id));
  if (
    previous.s.fleets.some(
      (fleet) =>
        fleet.owner === next.s.me.id &&
        fleet.state === 'back' &&
        fleet.ret !== undefined &&
        fleet.ret <= next.now &&
        !live.has(fleet.id),
    )
  )
    client.completedMenu.set('fleet', 'Die Flotte kehrt heim');
}

/** Shows the notice of what finished above the view. */
export function renderCompletions(view: HTMLElement): void {
  view.querySelector('#completion-notice')?.remove();
  if (!client.completionNotices.size) return;
  const notice = document.createElement('div');
  notice.id = 'completion-notice';
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  notice.textContent = [...client.completionNotices].join(' ');
  view.prepend(notice);
}
