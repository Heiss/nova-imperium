// The buddy list („Freunde“, #227, okf/features/buddy-list.md): request a
// friendship by name, accept or refuse a request, cancel the own request,
// end a friendship. The rules are those of src/core/friends.ts (patterns,
// section 7); here the facts are gathered and the codes worded. A new round
// keeps everything (owner, 2026-11-16, D2); deleting an account deletes its
// rows by the foreign keys.
import {
  type FriendAction,
  type FriendError,
  friendError,
  isOnline,
  relationOf,
} from '../../core/friends.ts';
import type { User } from '../db/repos/players.ts';
import type { Handler } from './actions.ts';
import { type Ctx, fail, str } from './context.ts';
import type { ServerFeature } from './feature.ts';

/** The German message of each refusal [V]; a crossed request names who asked first. */
export const FRIEND_ERROR: Readonly<
  Record<Exclude<FriendError, 'incoming'>, string>
> = {
  unknown: 'Spieler nicht gefunden.',
  self: 'Das bist du selbst.',
  friends: 'Ihr seid bereits Freunde.',
  outgoing: 'Deine Anfrage ist bereits offen.',
  noRequest: 'Diese Anfrage gibt es nicht.',
  noFriend: 'Diese Freundschaft gibt es nicht.',
};

/** Refuses `action` of `u` with `other` unless core `friendError` lets it through. */
function check(
  ctx: Ctx,
  u: User,
  action: FriendAction,
  other: User | null,
): User {
  const relation = other
    ? relationOf(ctx.friends.links(u.id), u.id, other.id)
    : 'none';
  const error = friendError(action, u.id, other?.id ?? null, relation);
  if (error === 'incoming')
    return fail(`${other!.name} hat dir bereits eine Anfrage geschickt.`);
  return error ? fail(FRIEND_ERROR[error]) : other!;
}

/** The other player of an answer, a cancel or a removal, by id. */
const byId = (ctx: Ctx, uid: unknown): User | null =>
  ctx.players.get(str(uid, 40)) ?? null;

/** Asks the player named `d.name` for a friendship. */
const requestFriend: Handler<'requestFriend'> = (ctx, u, d) => {
  const other = check(ctx, u, 'request', ctx.players.byName(str(d.name, 20)));
  ctx.friends.request(u.id, other.id);
  return 'Anfrage gesendet.';
};

/** Accepts (`d.accept` true) or refuses the open request of `d.uid`. */
const answerFriend: Handler<'answerFriend'> = (ctx, u, d) => {
  const accept = d.accept === true;
  const other = check(ctx, u, accept ? 'accept' : 'refuse', byId(ctx, d.uid));
  if (!accept) {
    ctx.friends.remove(u.id, other.id);
    return 'Anfrage abgelehnt.';
  }
  ctx.friends.accept(other.id, u.id);
  return 'Anfrage angenommen.';
};

/** Takes back the own open request to `d.uid`. */
const cancelFriend: Handler<'cancelFriend'> = (ctx, u, d) => {
  const other = check(ctx, u, 'cancel', byId(ctx, d.uid));
  ctx.friends.remove(u.id, other.id);
  return 'Anfrage zurückgezogen.';
};

/** Ends the friendship with `d.uid`; either friend may. */
const removeFriend: Handler<'removeFriend'> = (ctx, u, d) => {
  const other = check(ctx, u, 'remove', byId(ctx, d.uid));
  ctx.friends.remove(u.id, other.id);
  return 'Freundschaft beendet.';
};

/** A friend as the list shows them: the id (name and contact come from the public state) and online or offline (D1). */
interface FriendView {
  id: string;
  online: boolean;
}

/**
 * The buddy list of `uid`: friends, requests to them and their own requests,
 * each by name. A friend is online within `recentMinutes` of their last
 * activity, the threshold of the activity marker of the round (#229).
 */
export function friendState(
  ctx: Ctx,
  uid: string,
  recentMinutes: number,
): { list: FriendView[]; incoming: string[]; outgoing: string[] } {
  const names = new Map(ctx.players.all().map((p) => [p.id, p.name]));
  const byName = (a: string, b: string): number =>
    (names.get(a) ?? '').localeCompare(names.get(b) ?? '', 'de');
  const links = ctx.friends.links(uid);
  const other = (from: string, to: string): string =>
    from === uid ? to : from;
  const ids = (keep: (from: string) => boolean): string[] =>
    links
      .filter((l) => l.status === 'pending' && keep(l.from))
      .map((l) => other(l.from, l.to))
      .sort(byName);
  const now = ctx.now();
  const active = ctx.players.lastActive();
  return {
    list: links
      .filter((l) => l.status === 'friend')
      .map((l) => other(l.from, l.to))
      .sort(byName)
      .map((id) => ({
        id,
        online: isOnline(active[id], now, recentMinutes),
      })),
    incoming: ids((from) => from !== uid),
    outgoing: ids((from) => from === uid),
  };
}

export const serverFeature = {
  // Not guild actions: the buddy list (#227) works with guilds off.
  actions: { requestFriend, answerFriend, cancelFriend, removeFriend },
  state: {
    order: 120,
    keys: ['friends'],
    // The buddy list (#227): only the player's own friends and requests.
    build: (ctx, u, view) => ({
      friends: friendState(ctx, u.id, view.limits.recent),
    }),
  },
} satisfies ServerFeature;
