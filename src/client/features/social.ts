// The browser side of the guild chat (#169) and the buddy list (#227), out
// of main.ts (ratchet #242): the buttons and forms of both send their
// action and empty their field once it went through. Which action a button
// sends is decided in logic/friends.ts and logic/guild-chat.ts.
import { friendCall } from '../logic/friends.ts';
import { clearsChat } from '../logic/guild-chat.ts';
import type { ClientCtx, ClientFeature, Data } from './contract.ts';

type Act = ClientCtx['act'];

const field = (sel: string): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(sel);

/**
 * The guild chat: the text field empties once the message is in, unless a
 * new draft was typed meanwhile (CodeRabbit on #216).
 */
async function submitChat(act: Act): Promise<void> {
  const text = field('#chat_text')?.value ?? '';
  if (
    (await act('sendGuildChat', { text })) &&
    clearsChat(text, field('#chat_text')?.value)
  ) {
    const input = field('#chat_text');
    if (input) input.value = '';
    input?.focus();
  }
}

/** The buddy list: a request empties the name once it is sent. */
async function friend(act: Act, d: Data): Promise<void> {
  const call = friendCall(d, field('#friend_name')?.value ?? '', (q) =>
    window.confirm(q),
  );
  if (!call || !(await act(...call)) || d.op !== 'request') return;
  const input = field('#friend_name');
  if (input) input.value = '';
}

/** The data-act handlers of both; their forms are handled here too. */
export const clientFeature = {
  acts: ({ act }) => {
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
    return {
      guildChatDelete: (d) => {
        if (window.confirm('Nachricht löschen?'))
          return act('deleteGuildChat', { id: Number(d.id) });
      },
      friend: (d) => friend(act, d),
    };
  },
} satisfies ClientFeature;
