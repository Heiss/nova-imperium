// The key of the buddy list in the state (#227, #317).

/** The buddy list (#227), every player by id; name and contact come from `players`, `galaxy` and `guilds`. */
interface FriendState {
  /** The friends, by name, each online or offline (owner, 2026-11-16, D1). */
  list: { id: string; online: boolean }[];
  /** Open requests to the player, by name. */
  incoming: string[];
  /** The player's own open requests, by name. */
  outgoing: string[];
}

export type StateShape = {
  /** The buddy list (#227): the own friends and requests only. */
  friends: FriendState;
};
