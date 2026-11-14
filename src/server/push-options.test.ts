import { describe, expect, it } from 'vitest';
import { PUSH_TOPICS } from '../core/push.ts';
import { deleteAccount } from './delete-account.ts';
import { reset } from './game/admin.ts';
import { runAction } from './game/dispatch.ts';
import { stateFor } from './game/state.ts';
import { pushOff, pushOptions } from './push-options.ts';
import { addPlanet, addUser, testCtx } from './test-helpers.ts';

// The push kinds per account (#192): every kind is on until the player
// switches it off; the switches hold for all devices of the account.
describe('push options', () => {
  it('has every kind on for a new or existing player', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id);
    expect(pushOff(ctx, anna.id)).toEqual([]);
    expect(
      (stateFor(ctx, anna) as { me: { pushOff: unknown } }).me.pushOff,
    ).toEqual([]);
  });

  it('stores the kinds that are off, once each, in the order of the options', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const ben = addUser(ctx, 'Ben');
    addPlanet(ctx, anna.id);
    expect(
      pushOptions(ctx, anna, { off: ['guild-chat', 'news', 'guild-chat'] }),
    ).toBe('Gespeichert.');
    expect(pushOff(ctx, anna.id)).toEqual(['news', 'guild-chat']);
    expect(pushOff(ctx, ben.id)).toEqual([]);
    expect(
      (stateFor(ctx, anna) as { me: { pushOff: unknown } }).me.pushOff,
    ).toEqual(['news', 'guild-chat']);
    pushOptions(ctx, anna, { off: ['fleet'] });
    expect(pushOff(ctx, anna.id)).toEqual(['fleet']);
    pushOptions(ctx, anna, { off: [...PUSH_TOPICS].reverse() });
    expect(pushOff(ctx, anna.id)).toEqual(PUSH_TOPICS);
    pushOptions(ctx, anna, { off: [] });
    expect(pushOff(ctx, anna.id)).toEqual([]);
  });

  it('refuses an unknown kind or a list that is none and keeps the stored one', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    pushOptions(ctx, anna, { off: ['news'] });
    for (const off of [
      undefined,
      'news',
      { 0: 'news' },
      ['news', 'messages'],
      [null],
    ])
      expect(() => pushOptions(ctx, anna, { off })).toThrow('Ungültig.');
    expect(pushOff(ctx, anna.id)).toEqual(['news']);
  });

  it('keeps the switches over a new round', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna', { admin: true });
    addPlanet(ctx, anna.id);
    pushOptions(ctx, anna, { off: ['spied'] });
    reset(ctx, anna, {});
    expect(pushOff(ctx, anna.id)).toEqual(['spied']);
  });

  it('runs as the action „pushOptions“ and ends with the account', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id);
    expect(
      runAction(ctx, anna.id, { type: 'pushOptions', off: ['research'] }),
    ).toBe('Gespeichert.');
    expect(pushOff(ctx, anna.id)).toEqual(['research']);
    deleteAccount(ctx, anna, 'secret1');
    expect(ctx.db.prepare('SELECT * FROM push_off').all()).toEqual([]);
  });
});
