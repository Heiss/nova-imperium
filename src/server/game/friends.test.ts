// The buddy list (#227, owner, 2026-11-16): requests, acceptance, refusal,
// cancel and removal through the actions; duplicate, crossed and self
// requests refused deterministically; what each player sees (D1); a new
// round keeps everything (D2); a deleted account leaves nothing behind.
import { describe, expect, it } from 'vitest';
import { ONLINE_MS } from '../../core/friends.ts';
import { activity } from '../audit.ts';
import { deleteAccount } from '../delete-account.ts';
import { addPlanet, addUser, type TestCtx, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { FRIEND_ERROR, friendState } from './friends.ts';
import { stateFor } from './state.ts';

const START = Date.UTC(2026, 10, 17, 12, 0);

/** Anna (admin), Bert and Cora, each with a home planet. */
function world(): TestCtx {
  const ctx = testCtx(START);
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addUser(ctx, 'Cora');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 5 });
  addPlanet(ctx, 'u_Cora', { g: 2, s: 3, p: 6 });
  return ctx;
}

const run = (ctx: TestCtx, uid: string, type: string, d: object = {}) =>
  runAction(ctx, `u_${uid}`, { type, ...d });
const request = (ctx: TestCtx, from: string, name: unknown) =>
  run(ctx, from, 'requestFriend', { name });
const answer = (ctx: TestCtx, me: string, other: string, accept: unknown) =>
  run(ctx, me, 'answerFriend', { uid: `u_${other}`, accept });
const view = (ctx: TestCtx, uid: string) => friendState(ctx, `u_${uid}`);

describe('the messages', () => {
  it('words every refusal in German', () => {
    expect(FRIEND_ERROR).toEqual({
      unknown: 'Spieler nicht gefunden.',
      self: 'Das bist du selbst.',
      friends: 'Ihr seid bereits Freunde.',
      outgoing: 'Deine Anfrage ist bereits offen.',
      noRequest: 'Diese Anfrage gibt es nicht.',
      noFriend: 'Diese Freundschaft gibt es nicht.',
    });
  });
});

describe('requesting a friendship', () => {
  it('sends a request by name that both see, nobody else, and no friendship yet', () => {
    const ctx = world();
    expect(request(ctx, 'Anna', 'bert')).toBe('Anfrage gesendet.');
    expect(view(ctx, 'Anna')).toEqual({
      list: [],
      incoming: [],
      outgoing: ['u_Bert'],
    });
    expect(view(ctx, 'Bert')).toEqual({
      list: [],
      incoming: ['u_Anna'],
      outgoing: [],
    });
    expect(view(ctx, 'Cora')).toEqual({
      list: [],
      incoming: [],
      outgoing: [],
    });
  });

  it('refuses an unknown name and oneself', () => {
    const ctx = world();
    expect(() => request(ctx, 'Anna', 'Dora')).toThrow(FRIEND_ERROR.unknown);
    expect(() => request(ctx, 'Anna', 42)).toThrow(FRIEND_ERROR.unknown);
    expect(() => request(ctx, 'Anna', ' anna ')).toThrow(FRIEND_ERROR.self);
    expect(view(ctx, 'Anna').outgoing).toEqual([]);
  });

  it('refuses a duplicate, a crossed request and a request to a friend, changing nothing', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    const before = ctx.friends.links('u_Anna');
    expect(() => request(ctx, 'Anna', 'Bert')).toThrow(FRIEND_ERROR.outgoing);
    expect(() => request(ctx, 'Bert', 'Anna')).toThrow(
      'Anna hat dir bereits eine Anfrage geschickt.',
    );
    expect(ctx.friends.links('u_Anna')).toEqual(before);
    answer(ctx, 'Bert', 'Anna', true);
    expect(() => request(ctx, 'Anna', 'Bert')).toThrow(FRIEND_ERROR.friends);
    expect(() => request(ctx, 'Bert', 'Anna')).toThrow(FRIEND_ERROR.friends);
  });
});

describe('answering a request', () => {
  it('makes both friends on acceptance', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    expect(answer(ctx, 'Bert', 'Anna', true)).toBe('Anfrage angenommen.');
    expect(view(ctx, 'Anna')).toMatchObject({
      list: [{ id: 'u_Bert' }],
      incoming: [],
      outgoing: [],
    });
    expect(view(ctx, 'Bert').list).toMatchObject([{ id: 'u_Anna' }]);
    expect(view(ctx, 'Cora').list).toEqual([]);
  });

  it('deletes the request on refusal, so it can be sent again', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    expect(answer(ctx, 'Bert', 'Anna', false)).toBe('Anfrage abgelehnt.');
    expect(ctx.friends.links('u_Bert')).toEqual([]);
    expect(request(ctx, 'Anna', 'Bert')).toBe('Anfrage gesendet.');
  });

  it('accepts only on true; anything else refuses', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    expect(answer(ctx, 'Bert', 'Anna', 'true')).toBe('Anfrage abgelehnt.');
    expect(view(ctx, 'Bert').list).toEqual([]);
  });

  it('refuses an answer without an open request to oneself', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    // The requester cannot accept the own request.
    expect(() => answer(ctx, 'Anna', 'Bert', true)).toThrow(
      FRIEND_ERROR.noRequest,
    );
    expect(() => answer(ctx, 'Cora', 'Anna', true)).toThrow(
      FRIEND_ERROR.noRequest,
    );
    expect(() => answer(ctx, 'Bert', 'Dora', true)).toThrow(
      FRIEND_ERROR.unknown,
    );
    expect(() => answer(ctx, 'Bert', 'Bert', false)).toThrow(FRIEND_ERROR.self);
    answer(ctx, 'Bert', 'Anna', true);
    // A second acceptance changes nothing.
    expect(() => answer(ctx, 'Bert', 'Anna', true)).toThrow(
      FRIEND_ERROR.noRequest,
    );
    expect(view(ctx, 'Bert').list).toMatchObject([{ id: 'u_Anna' }]);
  });
});

describe('cancelling a request and ending a friendship', () => {
  it('lets the requester cancel the open request, once', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    expect(() => run(ctx, 'Bert', 'cancelFriend', { uid: 'u_Anna' })).toThrow(
      FRIEND_ERROR.noRequest,
    );
    expect(run(ctx, 'Anna', 'cancelFriend', { uid: 'u_Bert' })).toBe(
      'Anfrage zurückgezogen.',
    );
    expect(view(ctx, 'Bert').incoming).toEqual([]);
    expect(() => run(ctx, 'Anna', 'cancelFriend', { uid: 'u_Bert' })).toThrow(
      FRIEND_ERROR.noRequest,
    );
  });

  it('lets either friend end the friendship, once', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    expect(() => run(ctx, 'Anna', 'removeFriend', { uid: 'u_Bert' })).toThrow(
      FRIEND_ERROR.noFriend,
    );
    answer(ctx, 'Bert', 'Anna', true);
    expect(run(ctx, 'Bert', 'removeFriend', { uid: 'u_Anna' })).toBe(
      'Freundschaft beendet.',
    );
    expect(view(ctx, 'Anna').list).toEqual([]);
    expect(() => run(ctx, 'Anna', 'removeFriend', { uid: 'u_Bert' })).toThrow(
      FRIEND_ERROR.noFriend,
    );
    expect(() => run(ctx, 'Anna', 'removeFriend', { uid: 7 })).toThrow(
      FRIEND_ERROR.unknown,
    );
  });
});

describe('what friends see of each other (D1)', () => {
  it('shows only online or offline: 15 minutes after the last interaction', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    answer(ctx, 'Bert', 'Anna', true);
    expect(view(ctx, 'Anna').list).toEqual([{ id: 'u_Bert', online: false }]);
    activity(ctx, ctx.players.get('u_Bert')!);
    expect(view(ctx, 'Anna').list).toEqual([{ id: 'u_Bert', online: true }]);
    ctx.clock.t += ONLINE_MS - 1;
    expect(view(ctx, 'Anna').list[0]!.online).toBe(true);
    ctx.clock.t += 1;
    expect(view(ctx, 'Anna').list[0]!.online).toBe(false);
  });

  it('never shows whether a player with an open request is online', () => {
    const ctx = world();
    activity(ctx, ctx.players.get('u_Bert')!);
    request(ctx, 'Anna', 'Bert');
    expect(JSON.stringify(view(ctx, 'Anna'))).not.toContain('online');
    expect(JSON.stringify(view(ctx, 'Bert'))).not.toContain('online');
  });

  it('lists friends and requests by name in the state of the player', () => {
    const ctx = world();
    request(ctx, 'Cora', 'Anna');
    request(ctx, 'Bert', 'Anna');
    answer(ctx, 'Anna', 'Cora', true);
    expect(stateFor(ctx, ctx.players.get('u_Anna')!).friends).toEqual({
      list: [{ id: 'u_Cora', online: false }],
      incoming: ['u_Bert'],
      outgoing: [],
    });
  });

  it('sorts friends and requests by name', () => {
    const ctx = world();
    // An id that sorts last, a name that sorts first.
    addUser(ctx, 'Abel', { id: 'u_zz' });
    request(ctx, 'Cora', 'Bert');
    runAction(ctx, 'u_zz', { type: 'requestFriend', name: 'Bert' });
    request(ctx, 'Anna', 'Bert');
    expect(view(ctx, 'Bert').incoming).toEqual(['u_zz', 'u_Anna', 'u_Cora']);
    answer(ctx, 'Bert', 'Cora', true);
    run(ctx, 'Bert', 'answerFriend', { uid: 'u_zz', accept: true });
    expect(view(ctx, 'Bert').list.map((f) => f.id)).toEqual(['u_zz', 'u_Cora']);
    expect(view(ctx, 'Bert').incoming).toEqual(['u_Anna']);
  });
});

describe('a new round and a deleted account', () => {
  it('keep friendships and open requests across a new round (D2)', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    answer(ctx, 'Bert', 'Anna', true);
    request(ctx, 'Cora', 'Anna');
    const before = ctx.friends.links('u_Anna');
    run(ctx, 'Anna', 'reset', { guilds: false });
    expect(ctx.friends.links('u_Anna')).toEqual(before);
  });

  it('removes the friendships and requests of a deleted account', () => {
    const ctx = world();
    request(ctx, 'Anna', 'Bert');
    answer(ctx, 'Bert', 'Anna', true);
    request(ctx, 'Cora', 'Bert');
    request(ctx, 'Anna', 'Cora');
    deleteAccount(ctx, ctx.players.get('u_Bert')!, 'secret1');
    expect(view(ctx, 'Anna')).toEqual({
      list: [],
      incoming: [],
      outgoing: ['u_Cora'],
    });
    expect(view(ctx, 'Cora')).toEqual({
      list: [],
      incoming: ['u_Anna'],
      outgoing: [],
    });
  });
});
