// The rules of the buddy list (#227, okf/features/buddy-list.md): the
// relation of two players, the refusals of every friendship action in their
// order, and online or offline (owner, 2026-11-16, D1).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FRIEND_ACTIONS,
  type FriendAction,
  type FriendLink,
  type Relation,
  friendError,
  isOnline,
  relationOf,
} from './friends.ts';

const link = (
  from: string,
  to: string,
  status: FriendLink['status'] = 'pending',
): FriendLink => ({ from, to, status });

describe('the relation of two players', () => {
  it('is none without a link', () => {
    expect(relationOf([], 'a', 'b')).toBe('none');
    expect(
      relationOf([link('a', 'c'), link('c', 'b'), link('c', 'a')], 'a', 'b'),
    ).toBe('none');
    // A link of the other player with a third one is no link to me.
    expect(relationOf([link('b', 'c')], 'a', 'b')).toBe('none');
    expect(relationOf([link('b', 'c', 'friend')], 'a', 'b')).toBe('none');
  });

  it('is outgoing for an own request and incoming for one to me', () => {
    expect(relationOf([link('a', 'b')], 'a', 'b')).toBe('outgoing');
    expect(relationOf([link('a', 'b')], 'b', 'a')).toBe('incoming');
  });

  it('is friends in both directions once accepted', () => {
    const rows = [link('a', 'b', 'friend')];
    expect(relationOf(rows, 'a', 'b')).toBe('friends');
    expect(relationOf(rows, 'b', 'a')).toBe('friends');
  });

  it('never relates a player to themselves', () => {
    expect(relationOf([link('a', 'a', 'friend')], 'a', 'a')).toBe('none');
  });
});

describe('the refusals of the friendship actions', () => {
  const RELATIONS: Relation[] = ['none', 'outgoing', 'incoming', 'friends'];
  /** The one relation in which each action goes through. */
  const ALLOWED: Record<FriendAction, Relation> = {
    request: 'none',
    accept: 'incoming',
    refuse: 'incoming',
    cancel: 'outgoing',
    remove: 'friends',
  };

  it('knows the five actions', () => {
    expect([...FRIEND_ACTIONS]).toEqual([
      'request',
      'accept',
      'refuse',
      'cancel',
      'remove',
    ]);
  });

  it('refuses an unknown player first, then the player themselves', () => {
    for (const action of FRIEND_ACTIONS) {
      for (const relation of RELATIONS) {
        expect(friendError(action, 'a', null, relation)).toBe('unknown');
        expect(friendError(action, 'a', 'a', relation)).toBe('self');
      }
    }
  });

  it('lets each action through in exactly one relation', () => {
    for (const action of FRIEND_ACTIONS)
      for (const relation of RELATIONS)
        expect(friendError(action, 'a', 'b', relation) === null).toBe(
          relation === ALLOWED[action],
        );
  });

  it('names why a request is refused: friends, own request, crossed request', () => {
    expect(friendError('request', 'a', 'b', 'friends')).toBe('friends');
    expect(friendError('request', 'a', 'b', 'outgoing')).toBe('outgoing');
    expect(friendError('request', 'a', 'b', 'incoming')).toBe('incoming');
  });

  it('refuses an answer or a cancel without the open request, a removal without the friendship', () => {
    for (const relation of ['none', 'outgoing', 'friends'] as const) {
      expect(friendError('accept', 'a', 'b', relation)).toBe('noRequest');
      expect(friendError('refuse', 'a', 'b', relation)).toBe('noRequest');
    }
    for (const relation of ['none', 'incoming', 'friends'] as const)
      expect(friendError('cancel', 'a', 'b', relation)).toBe('noRequest');
    for (const relation of ['none', 'incoming', 'outgoing'] as const)
      expect(friendError('remove', 'a', 'b', relation)).toBe('noFriend');
  });

  it('is deterministic: the same facts give the same answer', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FRIEND_ACTIONS),
        fc.constantFrom('a', 'b', null),
        fc.constantFrom(...RELATIONS),
        (action, other, relation) =>
          friendError(action, 'a', other, relation) ===
          friendError(action, 'a', other, relation),
      ),
    );
  });
});

describe('online or offline', () => {
  const NOW = 1_763_300_000_000;
  const MINUTE = 60_000;

  it('is online within the minutes of the activity marker after the last activity', () => {
    expect(isOnline(NOW, NOW, 15)).toBe(true);
    expect(isOnline(NOW - 15 * MINUTE + 1, NOW, 15)).toBe(true);
    expect(isOnline(NOW - 15 * MINUTE, NOW, 15)).toBe(false);
    expect(isOnline(NOW - 15 * MINUTE - 1, NOW, 15)).toBe(false);
  });

  it('follows the threshold of the round', () => {
    expect(isOnline(NOW - 20 * MINUTE, NOW, 15)).toBe(false);
    expect(isOnline(NOW - 20 * MINUTE, NOW, 30)).toBe(true);
    expect(isOnline(NOW - 2 * MINUTE, NOW, 1)).toBe(false);
    expect(isOnline(NOW - MINUTE + 1, NOW, 1)).toBe(true);
  });

  it('is offline without any activity, however large the threshold', () => {
    expect(isOnline(undefined, NOW, 15)).toBe(false);
    expect(isOnline(undefined, NOW, 60)).toBe(false);
    expect(isOnline(undefined, 0, 1)).toBe(false);
  });

  it('is offline for an activity at the start of the clock', () => {
    expect(isOnline(0, NOW, 60)).toBe(false);
    expect(isOnline(0, 0, 15)).toBe(true);
  });
});
