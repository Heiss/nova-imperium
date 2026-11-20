// „Account löschen“ (#118, package 8; formerly in main.ts): the button of the
// options opens the confirmation with the password, a component that owns its
// input (views/DeleteAccountDialog.svelte). Once the server deleted the
// account, the push subscription goes, the dialog closes and the login shows.
import { deleteAccountDialogText } from '../logic/options.ts';
import { client } from '../logic/state.svelte.ts';
import { disablePush } from '../push.ts';
import { deleteAccountDialog } from '../views/account.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

/** Sends the deletion; true when the account is gone. */
export async function deleteAccount(
  ctx: ClientCtx,
  password: string,
): Promise<boolean> {
  try {
    await ctx.api('/api/account/delete', { password });
  } catch (error) {
    ctx.toast((error as Error).message, true);
    return false;
  }
  await disablePush(async () => ({})).catch(() => null);
  ctx.modal('');
  client.game = null;
  client.ui.auth = 'login';
  ctx.render(true);
  ctx.toast('Dein Account wurde gelöscht.');
  return true;
}

export const clientFeature = {
  acts: (ctx) => ({
    deleteAccount: () =>
      ctx.modal(
        deleteAccountDialog(
          deleteAccountDialogText(client.game!.round),
          (password) => deleteAccount(ctx, password),
        ),
      ),
  }),
} satisfies ClientFeature;
