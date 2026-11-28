// The key of the guilds in the state (#163, #169, #191, #317).
import type { ChatEventKind } from '../guild-chat.ts';
import type { GuildRight } from '../guild-ranks.ts';

interface GuildMember {
  id: string;
  name: string;
  /** None while the highscore shows nothing (#422, 182a). */
  points?: number;
}

export interface Guild {
  id: string;
  tag: string;
  name: string;
  html: string;
  members: GuildMember[];
  /** The sums of the points of the members; none while the highscore shows nothing (182a). */
  score?: number;
  average?: number;
}

export interface GuildRank {
  id: string;
  name: string;
  rights: GuildRight[];
}

/** The ranks of the own guild (#163); only its members get them. */
export interface GuildRanks {
  /** The Leitung. */
  lead: string;
  /** The own rank. */
  rank: string | null;
  /** The own rights. */
  rights: GuildRight[];
  /** The rank new members get. */
  default: string | null;
  /** Highest first; the first is the Leitung. */
  list: GuildRank[];
  /** The rank of every member. */
  members: Record<string, string | null>;
}

export interface GuildState {
  directory: Guild[];
  own: { id: string; status: 'member' | 'pending' } | null;
  /** For every member; the applications only for a rank with the right. */
  management: {
    id: string;
    description: string;
    pending: Pick<GuildMember, 'id' | 'name'>[];
  } | null;
  ranks?: GuildRanks | null;
  /** The chat of the own guild (#169); none without a chat right. */
  chat?: GuildChat | null;
}

/** A message or an event of the guild chat (#169). */
export interface GuildChatMessage {
  id: number;
  time: number;
  /** A message of a member, or an event of the server (D3, D4). */
  kind: 'message' | ChatEventKind;
  /**
   * The writer of a message, none for a former member or a deleted account
   * („ehemaliges Mitglied“); the member of an event, none once deleted.
   */
  name: string | null;
  /** The message; the new rank or the target of an event, else empty. */
  text: string;
  /** The attacker of an attack, none once deleted. */
  attacker?: string | null;
  /** The arrival of an attack. */
  arrival?: number | null;
  /** Whether the own rank may delete it; never an event. */
  delete: boolean;
}

/** The chat as the own rank sees it: the messages only with „Chat lesen“. */
export interface GuildChat {
  read: boolean;
  write: boolean;
  messages: GuildChatMessage[];
  /** Whether something is new since the last visit: the mark on „Gilden“. */
  unread: boolean;
  /** How many entries are new since then: the count of the tab „Gilde“ (#496). */
  unreadCount: number;
}

export type StateShape = {
  /** None while guilds are off in the round (#191). */
  guilds: GuildState | null;
};
