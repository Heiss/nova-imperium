// The key of the private messages in the state (#226, #317).
import type { PmLine } from '../private-messages.ts';

/** One conversation of the player: the other player by name, or the deleted accounts. */
interface PmConversation {
  /** The name of the other player; null for a deleted account (shown as „Gelöschter Spieler“). */
  with: string | null;
  /** Received messages not read yet. */
  unread: number;
  /** The messages the player did not delete from its own view, oldest first. */
  messages: PmLine[];
}

export type StateShape = {
  /** The private messages (#226): the player's own conversations only. */
  privateMessages: {
    /** The switch „only friends may write to me“. */
    friendsOnly: boolean;
    /** The names of the players the player blocked. */
    blocked: string[];
    /** Newest conversation first. */
    conversations: PmConversation[];
  };
};
