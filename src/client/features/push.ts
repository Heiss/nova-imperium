// Web Push in „Hilfe & Optionen“ (issue #192): switching it on and off for
// this device, and the checkbox of each kind, which saves at once. The boxes
// are in logic/push-options.ts, the browser calls in ../push.ts.
import { pushSaver } from '../logic/push-options.ts';
import { client } from '../logic/state.svelte.ts';
import { disablePush, enablePush } from '../push.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

async function togglePush(
  { api, toast }: ClientCtx,
  enabled: boolean,
): Promise<void> {
  try {
    await (enabled ? enablePush : disablePush)(api);
    toast(
      enabled
        ? 'Benachrichtigungen aktiviert.'
        : 'Benachrichtigungen deaktiviert.',
    );
  } catch (e) {
    toast((e as Error).message, e as Error);
  }
}

export const clientFeature = {
  listen: (ctx) => {
    /** The push kinds (#192): one save at a time, the newest choice wins. */
    const savePush = pushSaver(client.ui, (off) =>
      ctx.act('pushOptions', { off }),
    );
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset?.chg === 'push' && client.game)
        void savePush(
          client.game.me.pushOff,
          el.dataset.k,
          (el as unknown as HTMLInputElement).checked,
        ).then(() => ctx.render());
    });
  },
  acts: (ctx) => ({
    pushEnable: () => togglePush(ctx, true),
    pushDisable: () => togglePush(ctx, false),
  }),
} satisfies ClientFeature;
