// The frame of the page (#118, package 8; formerly in main.ts): the sheet
// „Mehr“, the dialog, the choice of the active planet and the logout. The
// markup is in views/Header.svelte, TabBar.svelte and MoreUser.svelte.
import { $, closeMore } from '../dom.ts';
import { stateUrl } from '../logic/address.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { disablePush } from '../push.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

/** Counts the choices of a planet; an answer of an older one is dropped. */
let planetRequest = 0;

/** Shows the planet or moon: loads its state, unless another choice or player came in meanwhile. */
export async function selectPlanet(
  { api, apply, toast }: ClientCtx,
  id: string,
): Promise<void> {
  const request = ++planetRequest;
  const player = client.game?.me.id;
  try {
    const state = (await api(stateUrl(id))) as unknown as GameState;
    if (
      request !== planetRequest ||
      !player ||
      client.game?.me.id !== player ||
      state.planet?.id !== id
    )
      return;
    client.forget();
    apply(state, true);
  } catch (e) {
    toast((e as Error).message, e as Error);
  }
}

/** Ends the session on the server and shows the login. */
export async function logout({ api, render }: ClientCtx): Promise<void> {
  await disablePush(api).catch(() => null);
  await api('/api/logout', {}).catch(() => null);
  client.game = null;
  client.ui.auth = 'login';
  render(true);
}

export const clientFeature = {
  listen: (ctx) => {
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.id === 'planet_select') void selectPlanet(ctx, el.value);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ctx.modal('');
    });
    // The „Mehr“ sheet and the dialog close on a tap beside them (on the backdrop).
    $('#more')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeMore();
    });
    $('#modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'modal') ctx.modal('');
    });
  },
  acts: (ctx) => ({
    moreOpen: () => $<HTMLDialogElement>('#more')!.showModal(),
    logout: () => logout(ctx),
    closeModal: () => ctx.modal(''),
    selectPlanet: (d) => {
      if (d.id) return selectPlanet(ctx, d.id);
    },
  }),
} satisfies ClientFeature;
