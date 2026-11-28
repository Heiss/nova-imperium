// Web Push in „Hilfe & Optionen“ (issue #192): switching it on and off for
// this device, and the checkbox of each kind, which saves at once. The boxes
// are in logic/push-options.ts, the browser calls in ../push.ts.
import { pushSaver, shownPushOff } from '../logic/push-options.ts';
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
      if (el.dataset?.chg !== 'push' || !client.game) return;
      const box = el as unknown as HTMLInputElement;
      const topic = el.dataset.k;
      // As the box „Keine Wachen annehmen“ (features/holding.ts, PR #469).
      void savePush(client.game.me.pushOff, topic, box.checked)
        .catch((err: unknown) =>
          ctx.toast((err as Error).message, err as Error),
        )
        .finally(() => {
          ctx.render();
          const off = client.game
            ? shownPushOff(client.ui, client.game.me.pushOff)
            : undefined;
          if (off) box.checked = !off.includes(topic!);
        });
    });
  },
  acts: (ctx) => ({
    pushEnable: () => togglePush(ctx, true),
    pushDisable: () => togglePush(ctx, false),
  }),
} satisfies ClientFeature;
