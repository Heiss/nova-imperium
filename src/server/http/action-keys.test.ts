// A repeated action runs once (#450): the key of a request, the outcome kept
// per player for its time, and what is not kept.
import { describe, expect, it, vi } from 'vitest';
import { GameError } from '../game/context.ts';
import {
  actionKeys,
  freshState,
  KEPT_MS,
  KEYS_PER_PLAYER,
  keyOf,
} from './action-keys.ts';
import { ACTIONS_PER_MINUTE } from './action-limit.ts';
import type { Reply } from './app.ts';

const req = (key?: string | string[], url = '/api/action') => ({
  headers: key === undefined ? {} : { 'idempotency-key': key },
  url,
});

function setup() {
  let t = 1_000_000;
  const keys = actionKeys(() => t);
  return {
    keys,
    later: (ms: number) => {
      t += ms;
    },
  };
}

const ok = (n: number): Reply => ({ json: { ok: true, n } });

describe('the key of a request (#450)', () => {
  it('is the header Idempotency-Key, 1 to 64 letters, digits or dashes', () => {
    const uuid = '0b9c2f44-6f1e-4c55-9d0a-2a8f3c1e7b11';
    expect(keyOf(req(uuid))).toBe(`/api/action ${uuid}`);
    expect(keyOf(req('a'))).toBe('/api/action a');
    expect(keyOf(req('x'.repeat(64)))).toBe(`/api/action ${'x'.repeat(64)}`);
    for (const bad of ['', 'x'.repeat(65), 'a b', 'ä', 'a;b', 'a_b'])
      expect(keyOf(req(bad)), bad).toBeNull();
    expect(keyOf(req())).toBeNull();
    expect(keyOf(req(['a', 'b']))).toBeNull();
  });

  it('counts per route, without the query', () => {
    expect(keyOf(req('k', '/api/admin/announce'))).toBe(
      '/api/admin/announce k',
    );
    expect(keyOf(req('k', '/api/action?x=1'))).toBe('/api/action k');
    expect(keyOf({ headers: { 'idempotency-key': 'k' } })).toBe('/ k');
  });
});

describe('a kept key (#450)', () => {
  it('runs the same key once; the repeat gets the first answer', () => {
    const { keys } = setup();
    const run = vi.fn(() => ok(1));
    expect(keys.once('u1', 'k', run)).toEqual(ok(1));
    expect(keys.once('u1', 'k', run)).toEqual(ok(1));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs two keys twice, and every request without a key', () => {
    const { keys } = setup();
    const run = vi.fn(() => ok(1));
    keys.once('u1', 'a', run);
    keys.once('u1', 'b', run);
    keys.once('u1', null, run);
    keys.once('u1', null, run);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('keeps the keys of each player apart', () => {
    const { keys } = setup();
    keys.once('u1', 'k', () => ok(1));
    expect(keys.once('u2', 'k', () => ok(2))).toEqual(ok(2));
    expect(keys.once('u1', 'k', () => ok(3))).toEqual(ok(1));
  });

  it('forgets a key after its time', () => {
    const { keys, later } = setup();
    keys.once('u1', 'k', () => ok(1));
    later(KEPT_MS - 1);
    expect(keys.once('u1', 'k', () => ok(2))).toEqual(ok(1));
    later(1);
    expect(keys.once('u1', 'k', () => ok(3))).toEqual(ok(3));
    expect(KEPT_MS).toBe(60_000);
  });

  it('keeps twice the actions of a minute per player, the oldest goes first', () => {
    const { keys } = setup();
    expect(KEYS_PER_PLAYER).toBe(2 * ACTIONS_PER_MINUTE);
    for (let i = 0; i <= KEYS_PER_PLAYER; i++)
      keys.once('u1', `k${i}`, () => ok(i));
    // k0 is gone, k1 to k240 stay.
    expect(keys.once('u1', 'k0', () => ok(-1))).toEqual(ok(-1));
    expect(keys.once('u1', 'k2', () => ok(-2))).toEqual(ok(2));
    expect(keys.once('u1', `k${KEYS_PER_PLAYER}`, () => ok(-3))).toEqual(
      ok(KEYS_PER_PLAYER),
    );
  });

  it('never drops a run in progress for the cap', async () => {
    const { keys } = setup();
    let done!: (r: Reply) => void;
    const slow = vi.fn(
      () =>
        new Promise<Reply>((resolve) => {
          done = resolve;
        }),
    );
    const first = keys.once('u1', 'slow', slow);
    for (let i = 0; i < KEYS_PER_PLAYER; i++)
      keys.once('u1', `k${i}`, () => ok(i));
    // The finished k0 went instead of the slow run.
    expect(keys.once('u1', 'k0', () => ok(-1))).toEqual(ok(-1));
    expect(keys.size().keys).toBe(KEYS_PER_PLAYER);
    const repeat = keys.once('u1', 'slow', slow);
    done(ok(7));
    await expect(first).resolves.toEqual(ok(7));
    await expect(repeat).resolves.toEqual(ok(7));
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('counts the time of a run in progress from its end', async () => {
    const { keys, later } = setup();
    let done!: (r: Reply) => void;
    const slow = vi.fn(
      () =>
        new Promise<Reply>((resolve) => {
          done = resolve;
        }),
    );
    const first = keys.once('u1', 'slow', slow);
    later(2 * KEPT_MS);
    // Still in progress: a repeat waits for it and runs nothing.
    const repeat = keys.once('u1', 'slow', slow);
    done(ok(7));
    await first;
    await expect(repeat).resolves.toEqual(ok(7));
    later(KEPT_MS - 1);
    expect(keys.once('u1', 'slow', () => ok(8))).toEqual(ok(7));
    later(1);
    expect(keys.once('u1', 'slow', () => ok(9))).toEqual(ok(9));
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('drops the keys past their time and the players without keys, of every player', () => {
    const { keys, later } = setup();
    keys.once('u1', 'a', () => ok(1));
    keys.once('u1', 'b', () => ok(1));
    keys.once('u2', 'a', () => ok(2));
    expect(keys.size()).toEqual({ players: 2, keys: 3 });
    later(KEPT_MS);
    keys.once('u3', 'a', () => ok(3));
    expect(keys.size()).toEqual({ players: 1, keys: 1 });
    // A request without a key does not touch the memory.
    later(KEPT_MS);
    keys.once('u3', null, () => ok(4));
    expect(keys.size()).toEqual({ players: 1, keys: 1 });
  });

  it('keeps an answer without its state; a repeat gets it from `fresh` only', () => {
    const { keys } = setup();
    const withState: Reply = { json: { ok: true, state: { big: 1 } } };
    expect(keys.once('u1', 'k', () => withState)).toBe(withState);
    expect(keys.once('u1', 'k', () => ok(2))).toEqual({
      json: { ok: true, state: undefined },
    });
    expect(
      keys.once(
        'u1',
        'k',
        () => ok(3),
        (r) => freshState(r, () => 'now'),
      ),
    ).toEqual({ json: { ok: true, state: 'now' } });
  });

  it('keeps the answer of a run in progress without its state', async () => {
    const { keys } = setup();
    const withState: Reply = { json: { ok: true, state: { big: 1 } } };
    await expect(
      keys.once('u1', 'k', () => Promise.resolve(withState)),
    ).resolves.toBe(withState);
    expect(keys.once('u1', 'k', () => ok(2))).toEqual({
      json: { ok: true, state: undefined },
    });
  });

  it('gives a refusal of the game again, without running', () => {
    const { keys } = setup();
    const run = vi.fn((): Reply => {
      throw new GameError('Nicht genug Rohstoffe.');
    });
    expect(() => keys.once('u1', 'k', run)).toThrow('Nicht genug Rohstoffe.');
    expect(() => keys.once('u1', 'k', run)).toThrow('Nicht genug Rohstoffe.');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('forgets an outcome that is not final, so a resend runs again', () => {
    const { keys } = setup();
    const busy = vi.fn((): Reply => ({ status: 503, json: { code: 'x' } }));
    keys.once('u1', 'busy', busy);
    keys.once('u1', 'busy', busy);
    expect(busy).toHaveBeenCalledTimes(2);
    const crash = vi.fn((): Reply => {
      throw new Error('disk full');
    });
    expect(() => keys.once('u1', 'crash', crash)).toThrow('disk full');
    expect(() => keys.once('u1', 'crash', crash)).toThrow('disk full');
    expect(crash).toHaveBeenCalledTimes(2);
    // A refusal below 500 is final: an answer of 400 is kept.
    const refused = vi.fn((): Reply => ({ status: 499, json: {} }));
    keys.once('u1', 'refused', refused);
    keys.once('u1', 'refused', refused);
    expect(refused).toHaveBeenCalledTimes(1);
    const server = vi.fn((): Reply => ({ status: 500, json: {} }));
    keys.once('u1', 'server', server);
    keys.once('u1', 'server', server);
    expect(server).toHaveBeenCalledTimes(2);
  });

  it('renews the answer of a repeat only, with `fresh`', () => {
    const { keys } = setup();
    const fresh = vi.fn((r: Reply) => ({ ...r, status: 201 }));
    expect(keys.once('u1', 'k', () => ok(1), fresh)).toEqual(ok(1));
    expect(fresh).not.toHaveBeenCalled();
    expect(keys.once('u1', 'k', () => ok(2), fresh)).toEqual({
      ...ok(1),
      status: 201,
    });
  });

  it('lets a repeat wait for a first run still in progress', async () => {
    const { keys } = setup();
    let done!: (r: Reply) => void;
    const run = vi.fn(
      () =>
        new Promise<Reply>((resolve) => {
          done = resolve;
        }),
    );
    const first = keys.once('u1', 'k', run);
    const second = keys.once('u1', 'k', run);
    expect(run).toHaveBeenCalledTimes(1);
    done(ok(7));
    await expect(first).resolves.toEqual(ok(7));
    await expect(second).resolves.toEqual(ok(7));
    await expect(keys.once('u1', 'k', run)).toEqual(ok(7));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps a refusal of a run in progress, and forgets a failure', async () => {
    const { keys } = setup();
    const refused = vi.fn(() => Promise.reject(new GameError('Nein.')));
    await expect(keys.once('u1', 'r', refused)).rejects.toThrow('Nein.');
    expect(() => keys.once('u1', 'r', refused)).toThrow('Nein.');
    expect(refused).toHaveBeenCalledTimes(1);
    const failed = vi.fn(() => Promise.reject(new Error('mail down')));
    await expect(keys.once('u1', 'f', failed)).rejects.toThrow('mail down');
    await expect(keys.once('u1', 'f', failed)).rejects.toThrow('mail down');
    expect(failed).toHaveBeenCalledTimes(2);
  });

  it('forgets the keys past their time on access, of every player', () => {
    const { keys, later } = setup();
    keys.once('u1', 'k', () => ok(1));
    keys.once('u2', 'k', () => ok(2));
    later(KEPT_MS);
    expect(keys.once('u1', 'k', () => ok(3))).toEqual(ok(3));
    expect(keys.once('u2', 'k', () => ok(4))).toEqual(ok(4));
  });
});

describe('the state of a repeat (#450, 4A)', () => {
  it('is built now, where the answer has one', () => {
    expect(
      freshState({ json: { ok: true, state: 'old' } }, () => 'now'),
    ).toEqual({ json: { ok: true, state: 'now' } });
    expect(freshState({ json: { ok: true } }, () => 'now')).toEqual({
      json: { ok: true },
    });
    expect(freshState({ status: 204 }, () => 'now')).toEqual({ status: 204 });
  });
});
