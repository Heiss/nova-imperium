// The buddy list in the browser („Freunde“, #227,
// okf/features/buddy-list.md): each friend with the name, the guild tag and
// a planet on the Sternenkarte as the contact, and online or offline (owner,
// 2026-11-16, D1); the open requests both ways; the mark on „Freunde“; and
// which action each button sends. The server checks every action
// (src/core/friends.ts).
import type { ActionInput } from '../../core/actions.ts';
import type { V } from '../views/common.ts';
import { coords } from './format.ts';
import type { GalaxyPlanet, GameState } from './types.ts';

/** A player of the list: id and name. */
export interface Named {
  id: string;
  name: string;
}

/** A friend as the list shows them. */
export interface Contact extends Named {
  /** The tag of the guild the friend is a member of; null without one or while guilds are off. */
  tag: string | null;
  /** The planet the Sternenkarte link opens; null without one. */
  home: GalaxyPlanet | null;
  online: boolean;
}

/** A planet of `owner`, never a moon: the one the Highscore names (#53). */
export const homePlanetOf = (
  galaxy: readonly GalaxyPlanet[],
  owner: string,
): GalaxyPlanet | null =>
  galaxy.find((p) => p.owner === owner && p.kind === 'planet') ?? null;

/** A planet with the link to its system on the Sternenkarte: its name, the system and the place as text. */
export interface HomeLink {
  name: string;
  g: number;
  s: number;
  at: string;
}

/** The link a planet shows (the Highscore, the buddy list), or null without a planet. */
export const homeLink = (pl: GalaxyPlanet | null): HomeLink | null =>
  pl && { name: pl.name, g: pl.g, s: pl.s, at: coords(pl) };

/** The friends and the open requests of the state, with names. */
export function buddyList(s: GameState): {
  list: Contact[];
  incoming: Named[];
  outgoing: Named[];
} {
  const named = (id: string): Named => ({
    id,
    name: s.players[id]?.name ?? '',
  });
  const tag = (id: string): string | null =>
    s.guilds?.directory.find((g) => g.members.some((m) => m.id === id))?.tag ??
    null;
  const friends = s.friends;
  return {
    list: (friends?.list ?? []).map((f) => ({
      ...named(f.id),
      tag: tag(f.id),
      home: homePlanetOf(s.galaxy, f.id),
      online: f.online,
    })),
    incoming: (friends?.incoming ?? []).map(named),
    outgoing: (friends?.outgoing ?? []).map(named),
  };
}

/** The mark on „Freunde“: open requests to the player [V]. */
export const friendsHint = (s: GameState): string =>
  s.friends?.incoming.length ? 'Offene Freundschaftsanfragen' : '';

/** The question before a friendship ends [V]. */
export const FRIEND_END = 'Freundschaft beenden?';

/** An action of the buddy list with its input: the name picks the type of the data. */
export type FriendCall = {
  [K in 'requestFriend' | 'answerFriend' | 'cancelFriend' | 'removeFriend']: [
    type: K,
    data: ActionInput<K>,
  ];
}['requestFriend' | 'answerFriend' | 'cancelFriend' | 'removeFriend'];

/**
 * The action a button of the list sends (`op`, the player `uid`), or null:
 * nothing without a typed name, an unanswered question, an unknown button.
 */
export function friendCall(
  d: { op?: string; uid?: string },
  name: string,
  confirm: (question: string) => boolean,
): FriendCall | null {
  switch (d.op) {
    case 'request': {
      const typed = name.trim();
      return typed ? ['requestFriend', { name: typed }] : null;
    }
    case 'accept':
    case 'refuse':
      return ['answerFriend', { uid: d.uid, accept: d.op === 'accept' }];
    case 'cancel':
      return ['cancelFriend', { uid: d.uid }];
    case 'remove':
      return confirm(FRIEND_END) ? ['removeFriend', { uid: d.uid }] : null;
    default:
      return null;
  }
}

/** One line of the table of friends: `tag` is „[tag]“ or „-“. */
interface FriendRow extends Named {
  tag: string;
  home: HomeLink | null;
  online: boolean;
}

/** What the page shows: the friends, the requests to the player and the own ones. */
export interface FriendsPage {
  rows: FriendRow[];
  incoming: Named[];
  outgoing: Named[];
}

/** The page „Freunde“ (#227) of the view state, as the component Friends renders it (#118). */
export function friendsPage(v: V): FriendsPage {
  const { list, incoming, outgoing } = buddyList(v.s);
  return {
    rows: list.map((f) => ({
      id: f.id,
      name: f.name,
      tag: f.tag === null ? '-' : `[${f.tag}]`,
      home: homeLink(f.home),
      online: f.online,
    })),
    incoming,
    outgoing,
  };
}
