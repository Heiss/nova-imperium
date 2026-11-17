// The buddy list („Freunde“, #227, okf/features/buddy-list.md): a
// friendship exists only once its request is accepted. These rules are
// pure (patterns, section 7): the server gathers the facts, asks
// `friendError` and turns its code into the German message.

/** A stored link: an open request from `from` to `to`, or a friendship. */
export interface FriendLink {
  from: string;
  to: string;
  status: 'pending' | 'friend';
}

/** How player `me` relates to another: no link, an open request either way, or friends. */
export type Relation = 'none' | 'outgoing' | 'incoming' | 'friends';

/** The relation of `me` to `other` among `links`; a player never relates to themselves. */
export function relationOf(
  links: readonly FriendLink[],
  me: string,
  other: string,
): Relation {
  if (me === other) return 'none';
  const found = links.find(
    (l) =>
      (l.from === me && l.to === other) || (l.from === other && l.to === me),
  );
  if (!found) return 'none';
  if (found.status === 'friend') return 'friends';
  return found.from === me ? 'outgoing' : 'incoming';
}

/** What a player does: request, accept or refuse a request to them, cancel their own, end a friendship. */
export const FRIEND_ACTIONS = [
  'request',
  'accept',
  'refuse',
  'cancel',
  'remove',
] as const;
export type FriendAction = (typeof FRIEND_ACTIONS)[number];

/**
 * Why an action is refused: no such player, the player themselves, already
 * friends, an own open request, a crossed request (the other one asked
 * first), no open request to answer or cancel, no friendship to end.
 */
export type FriendError =
  | 'unknown'
  | 'self'
  | 'friends'
  | 'outgoing'
  | 'incoming'
  | 'noRequest'
  | 'noFriend';

/** The relation in which each action goes through. */
const ALLOWED: Readonly<Record<FriendAction, Relation>> = {
  request: 'none',
  accept: 'incoming',
  refuse: 'incoming',
  cancel: 'outgoing',
  remove: 'friends',
};

/**
 * Why `me` cannot do `action` with `other` (null when no such player), or
 * null when it goes through: the player first, then the relation. A repeated
 * action is refused and changes nothing, so every action is idempotent.
 */
export function friendError(
  action: FriendAction,
  me: string,
  other: string | null,
  relation: Relation,
): FriendError | null {
  if (other === null) return 'unknown';
  if (other === me) return 'self';
  if (relation === ALLOWED[action]) return null;
  if (action === 'request') return relation as Exclude<Relation, 'none'>;
  return action === 'remove' ? 'noFriend' : 'noRequest';
}

/**
 * How long a player counts as online after the last interaction: 15
 * minutes, the star of the classic activity indicators (#229) [V].
 */
export const ONLINE_MS = 15 * 60 * 1000;

/** Whether a player whose last interaction was at `last` is online at `now`. */
export const isOnline = (last: number | undefined, now: number): boolean =>
  last !== undefined && now - last < ONLINE_MS;
