// The authenticator app of the own account (#401; owner, 2026-11-25, text 4
// and 137a): „Einrichten“ asks the server for a secret and shows it as a QR
// code, the first code confirms it; „Entfernen“ sends the password and a
// code of the app. After each the state is loaded again, so the box shows
// whether an app is set up. The secret of „Einrichten“ is kept only for the
// account that asked: an answer after a sign-out or for another account is
// dropped, and signing out forgets it. The box is
// views/options/TotpBox.svelte.
import { $, val } from '../dom.ts';
import { client } from '../logic/state.svelte.ts';
import { endTotpSetup, totpSetup } from '../logic/totp-setup.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

async function reload(ctx: ClientCtx): Promise<void> {
  ctx.apply((await ctx.api('/api/state')) as unknown as GameState, true);
}

async function beginSetup(ctx: ClientCtx): Promise<void> {
  const player = client.game?.me.id;
  try {
    const j = await ctx.api('/api/totp/setup', {});
    // An answer after a sign-out, or for another account, is dropped.
    if (!player || client.game?.me.id !== player) return;
    totpSetup.uri = String(j.uri);
    totpSetup.secret = String(j.secret);
    ctx.render();
    $('#totp_code')?.focus();
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

async function confirmSetup(ctx: ClientCtx): Promise<void> {
  try {
    await ctx.api('/api/totp/confirm', { code: val('#totp_code') });
    endTotpSetup();
    await reload(ctx);
    ctx.toast('Authenticator-App eingerichtet.');
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

async function remove(ctx: ClientCtx): Promise<void> {
  try {
    await ctx.api('/api/totp/remove', {
      password: val('#totp_password'),
      code: val('#totp_remove_code'),
    });
    await reload(ctx);
    ctx.toast('Authenticator-App entfernt.');
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

export const clientFeature = {
  acts: (ctx) => ({ totpSetup: () => beginSetup(ctx) }),
  forms: (ctx) => ({
    totpconfirmform: () => confirmSetup(ctx),
    totpremoveform: () => remove(ctx),
  }),
} satisfies ClientFeature;
