// What the player has read (formerly in main.ts), told to the server after a
// render: the page „Nachrichten“ marks the reports as read (#169 and before),
// and the chat of a guild that the member saw clears the mark on „Gilden“,
// on the page of the guild, in the tab „Gilde“ or in the chat window (#496).
import { guildChatShown, onGuildChatShown } from '../logic/chat-shown.ts';
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
  const id = chatToSee(
    client.game!,
    client.ui.view,
    client.ui.params.guild ?? null,
    guildChatShown(),
  );
  if (id === null || seePending) return;
  seePending = true;
  setTimeout(() => {
    void ctx
      .quiet('seeGuildChat', { id })
      .finally(() => void (seePending = false));
  }, DELAY_MS);
}

export const clientFeature = {
  listen: (given) => {
    ctx = given;
    // The tab „Gilde“ or the chat window comes into sight without a render (#496).
    onGuildChatShown(() => {
      if (client.game) seeChat();
    });
  },
  acts: () => ({}),
  afterRender: () => {
    if (!client.game) return;
    if (client.ui.view === 'messages') markRead();
    seeChat();
  },
} satisfies ClientFeature;
