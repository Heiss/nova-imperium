// What the player has read (formerly in main.ts), told to the server after a
// render: the page „Nachrichten“ marks the reports as read (#169 and before),
// and the chat of a guild that the member saw clears the mark on „Gilden“.
import { chatToSee } from '../logic/menu-hints.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

const DELAY_MS = 600;

let ctx: ClientCtx;
let readPending = false;
let seePending = false;

function markRead(): void {
  const game = client.game!;
  const newest = Math.max(0, ...game.reports.map((r) => r.time));
  if (newest > (game.me.readAt || 0) && !readPending) {
    readPending = true;
    setTimeout(
      () => void ctx.act('read').finally(() => (readPending = false)),
      DELAY_MS,
    );
  }
}

/** The member saw the chat of its guild: the mark on „Gilden“ goes (#169). */
function seeChat(): void {
  const id = chatToSee(client.game!, client.ui.view, client.ui.guild ?? null);
  if (id === null || seePending) return;
  seePending = true;
  setTimeout(() => {
    void ctx
      .quiet('seeGuildChat', { id })
      .finally(() => void (seePending = false));
  }, DELAY_MS);
}

export const clientFeature = {
  acts: (given) => {
    ctx = given;
    return {};
  },
  afterRender: () => {
    if (!client.game) return;
    if (client.ui.view === 'messages') markRead();
    seeChat();
  },
} satisfies ClientFeature;
