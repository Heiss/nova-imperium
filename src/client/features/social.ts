// The browser side of the guild chat (#169) and the buddy list (#227), out
// of main.ts (ratchet #242): the buttons and forms of both send their
// action and empty their field once it went through. Which action a button
// sends is decided in logic/friends.ts and logic/guild-chat.ts.
import { runLocked } from '../logic/act-lock.ts';
import { drafts } from '../logic/drafts.svelte.ts';
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
  const text = drafts.get('guildChat');
  if (
    (await act('sendGuildChat', { text })) &&
    clearsChat(text, drafts.get('guildChat'))
  ) {
    drafts.clear('guildChat');
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
  const call = friendCall(d, drafts.get('friendName'), (q) =>
    window.confirm(q),
  );
  if (!call || !(await sendFriend(act, call)) || d.op !== 'request') return;
  drafts.clear('friendName');
}

/** The data-act handlers of both; their forms are handled here too. */
export const clientFeature = {
  listen: ({ act }) => {
    // Each form is locked while its action runs, like every form (#428).
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLElement;
      if (form.id === 'guildchatform') {
        e.preventDefault();
        void runLocked(form, () => submitChat(act));
      } else if (form.id === 'friendform') {
        e.preventDefault();
        void runLocked(form, () => friend(act, { op: 'request' }));
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
