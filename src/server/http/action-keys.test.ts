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
import type { Reply } from './app.ts';

const req = (key?: string | string[]) => ({
  headers: key === undefined ? {} : { 'idempotency-key': key },
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
    expect(keyOf(req(uuid))).toBe(uuid);
    expect(keyOf(req('a'))).toBe('a');
    expect(keyOf(req('x'.repeat(64)))).toBe('x'.repeat(64));
    for (const bad of ['', 'x'.repeat(65), 'a b', 'ä', 'a;b', 'a_b'])
      expect(keyOf(req(bad)), bad).toBeNull();
    expect(keyOf(req())).toBeNull();
    expect(keyOf(req(['a', 'b']))).toBeNull();
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

  it('keeps at most 50 keys of a player, the oldest goes first', () => {
    const { keys } = setup();
    expect(KEYS_PER_PLAYER).toBe(50);
    for (let i = 0; i <= KEYS_PER_PLAYER; i++)
      keys.once('u1', `k${i}`, () => ok(i));
    // k0 is gone, k1 to k50 stay.
    expect(keys.once('u1', 'k0', () => ok(-1))).toEqual(ok(-1));
    expect(keys.once('u1', 'k2', () => ok(-2))).toEqual(ok(2));
    expect(keys.once('u1', 'k50', () => ok(-3))).toEqual(ok(50));
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

  it('sweeps the keys past their time of every player', () => {
    const { keys, later } = setup();
    keys.once('u1', 'k', () => ok(1));
    keys.once('u2', 'k', () => ok(2));
    later(KEPT_MS);
    keys.sweep();
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
