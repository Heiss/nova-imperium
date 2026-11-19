// The list of the passkeys of the account in „Hilfe & Optionen“: showing,
// adding with the password and removing one. Signing in with a passkey is
// part of the login in main.ts; the browser calls are in ../passkeys.ts.
import { $, val } from '../dom.ts';
import { dt, esc } from '../logic/format.ts';
import { addPasskey } from '../passkeys.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

async function showPasskeys({ api, toast }: ClientCtx): Promise<void> {
  try {
    const j = await api('/api/passkeys/list', {});
    const keys = j.keys as { id: string; created: number }[];
    const list = $('#passkey-list');
    if (!list) return;
    list.innerHTML = keys.length
      ? '<ul>' +
        keys
          .map(
            (key) =>
              `<li>Erstellt am ${dt(key.created)} <button type="button" data-act="removePasskey" data-id="${esc(key.id)}">Entfernen</button></li>`,
          )
          .join('') +
        '</ul>'
      : '<p>Keine Passkeys gespeichert.</p>';
  } catch (error) {
    toast((error as Error).message, true);
  }
}

async function submitPasskey(ctx: ClientCtx): Promise<void> {
  try {
    await addPasskey(ctx.api, val('#passkey-password'));
    ctx.setInput('#passkey-password', '');
    ctx.toast('Passkey gespeichert.');
    await showPasskeys(ctx);
  } catch (error) {
    ctx.toast((error as Error).message, true);
  }
}

/** The data-act handlers of the list of passkeys; its form adds one. */
export const clientFeature = {
  acts: (ctx) => ({
    listPasskeys: () => showPasskeys(ctx),
    removePasskey: async (d) => {
      if (!window.confirm('Diesen Passkey entfernen?')) return;
      try {
        await ctx.api('/api/passkeys/remove', { id: d.id });
        await showPasskeys(ctx);
      } catch (error) {
        ctx.toast((error as Error).message, true);
      }
    },
  }),
  forms: (ctx) => ({ passkeyform: () => submitPasskey(ctx) }),
} satisfies ClientFeature;
