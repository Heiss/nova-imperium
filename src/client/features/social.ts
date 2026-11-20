// The browser side of the guild chat (#169) and the buddy list (#227), out
// of main.ts (ratchet #242): the buttons and forms of both send their
// action and empty their field once it went through. Which action a button
// sends is decided in logic/friends.ts and logic/guild-chat.ts.
import { drafts, FRIEND_NAME, GUILD_CHAT } from '../logic/drafts.svelte.ts';
import { friendCall, type FriendCall } from '../logic/friends.ts';
import { clearsChat } from '../logic/guild-chat.ts';
import type { ClientCtx, ClientFeature, Data } from './contract.ts';

type Act = ClientCtx['act'];

const field = (sel: string): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(sel);

/**
 * The guild chat: the draft goes once the message is in, unless a new draft
 * was typed meanwhile (CodeRabbit on #216). The field shows the draft of
 * logic/drafts.svelte.ts, so a redraw never takes what is typed.
 */
async function submitChat(act: Act): Promise<void> {
  const text = drafts.get(GUILD_CHAT);
  if (
    (await act('sendGuildChat', { text })) &&
    clearsChat(text, drafts.get(GUILD_CHAT))
  ) {
    drafts.clear(GUILD_CHAT);
    field('#chat_text')?.focus();
  }
}

/** Sends the action a button of the buddy list chose; the name of the call picks the type of its data. */
function sendFriend(act: Act, call: FriendCall): Promise<boolean> {
  switch (call[0]) {
    case 'requestFriend':
      return act(call[0], call[1]);
    case 'answerFriend':
      return act(call[0], call[1]);
    default:
      return act(call[0], call[1]);
  }
}

/** The buddy list: a request empties the name once it is sent. */
async function friend(act: Act, d: Data): Promise<void> {
  const call = friendCall(d, drafts.get(FRIEND_NAME), (q) => window.confirm(q));
  if (!call || !(await sendFriend(act, call)) || d.op !== 'request') return;
  drafts.clear(FRIEND_NAME);
}

/** The data-act handlers of both; their forms are handled here too. */
export const clientFeature = {
  listen: ({ act }) => {
    document.addEventListener('submit', (e) => {
      const id = (e.target as HTMLElement).id;
      if (id === 'guildchatform') {
        e.preventDefault();
        void submitChat(act);
      } else if (id === 'friendform') {
        e.preventDefault();
        void friend(act, { op: 'request' });
      }
    });
  },
  acts: ({ act }) => ({
    guildChatDelete: (d) => {
      if (window.confirm('Nachricht löschen?'))
        return act('deleteGuildChat', { id: Number(d.id) });
    },
    friend: (d) => friend(act, d),
  }),
} satisfies ClientFeature;
