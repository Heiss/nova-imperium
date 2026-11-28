// The state of the server in the client (formerly in main.ts): taking over
// what an answer brought, sending game actions, and the refresh the poll and
// the clock ask for. Every game action of the views goes through `act`
// (logic/act.ts, #118).
import { api } from './api.ts';
import { $ } from './dom.ts';
import type { ClientCtx } from './features/contract.ts';
import { createAct, placeOf, samePlace } from './logic/act.ts';
import { stateUrl } from './logic/address.ts';
import { login } from './logic/login.ts';
import { openQuery } from './logic/private-messages.ts';
import { shownQuery } from './logic/galaxy-shown.ts';
import { scanOf } from './logic/phalanx.ts';
import { client } from './logic/state.svelte.ts';
import type { GameState } from './logic/types.ts';
import { loadNews } from './news.ts';
import { render } from './render.ts';
import { toast } from './toast.ts';
import { gameView, urlOf } from './view-address.ts';

/** Takes over the state of the server; the views render when it changed, or at once when `fresh`. */
export function apply(st: GameState | undefined, fresh = false): void {
  if (!st || login.resetToken) return;
  const ui = client.ui;
  const key = JSON.stringify({ ...st, now: 0 });
  const same = key === client.lastKey;
  client.lastKey = key;
  if (
    client.game &&
    (st.me.id !== client.game.me.id ||
      st.round.number !== client.game.round.number)
  )
    client.forgetPlayer();
  client.offset = st.now - Date.now();
  client.game = st;
  void loadNews();
  const view = gameView(ui.view);
  if (view !== ui.view) {
    ui.view = view;
    history.replaceState(null, '', urlOf(view));
  }
  $('#unisub')!.textContent = `Classic Universum · Speed x${st.cfg.speed}`;
  if (!same || fresh) render(fresh);
}

const sync = createAct({
  api,
  state: () => client.game,
  apply: (state) => apply(state),
  toast,
  extra: () => ({ ...openQuery(), ...shownQuery() }),
  answer: (data) => {
    const scan = scanOf(data);
    if (scan) client.ui.scan = scan;
  },
});

/** Whether the action went through, wherever the player is now. */
export const act: ClientCtx['act'] = async (type, ...data) =>
  (await sync.send(type, ...data)) !== 'failed';

/**
 * Whether the action went through on the planet still shown, so its form
 * may be cleared; not when the player switched planets meanwhile (#209).
 */
export const actHere: ClientCtx['actHere'] = async (type, ...data) =>
  (await sync.send(type, ...data)) === 'done';

/** An action the client starts by itself; a refusal is no message (#301). */
export const quiet: ClientCtx['quiet'] = async (type, ...data) =>
  (await sync.quiet(type, ...data)) !== 'failed';

/** An action whose refusal the caller shows itself (the dialog of a message, #349); whether it went through. */
export const actOwn: ClientCtx['actOwn'] = async (refused, type, ...data) =>
  (await sync.own(refused, type, ...data)) !== 'failed';

/** Loads the state of the shown place again. */
export async function refresh(): Promise<void> {
  const before = placeOf(client.game);
  const planet = before.planet;
  // A refresh that overlaps an action never brings back an older state.
  const fresh = sync.refresh();
  try {
    const state = (await api(
      stateUrl(planet === client.game?.mainPlanet ? undefined : planet, {
        ...openQuery(),
        ...shownQuery(),
      }),
    )) as unknown as GameState;
    if (fresh() && samePlace(client.game, before)) apply(state);
  } catch (e) {
    if (client.game) console.warn(e);
  }
}
