// The lock of a clicked `data-act` element while its handler runs (#425).
import { describe, expect, it, vi } from 'vitest';
import { runLocked } from './act-lock.ts';

/** A promise and the functions that settle it. */
function pending(): {
  promise: Promise<boolean>;
  resolve: (v: boolean) => void;
  reject: (e: Error) => void;
} {
  let resolve!: (v: boolean) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets the `finally` of the lock run. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('runLocked', () => {
  it('runs nothing on a second click while the handler is pending', async () => {
    const el = {};
    const p = pending();
    const run = vi.fn(() => p.promise);
    const first = runLocked(el, run);
    expect(runLocked(el, run)).toBeUndefined();
    expect(runLocked(el, run)).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
    p.resolve(true);
    await expect(first).resolves.toBe(true);
    runLocked(el, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('frees the element after a rejected handler and passes the rejection on', async () => {
    const el = {};
    const p = pending();
    const run = vi.fn(() => p.promise);
    const first = runLocked(el, run);
    p.reject(new Error('Netzwerk'));
    expect(runLocked(el, run)).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
    await expect(first).rejects.toThrow('Netzwerk');
    const second = runLocked(el, () => Promise.resolve(true));
    await expect(second).resolves.toBe(true);
  });

  it('frees the element after a refused action (false)', async () => {
    const el = {};
    const run = vi.fn(() => Promise.resolve(false));
    runLocked(el, run);
    await settle();
    runLocked(el, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('locks nothing for a handler that finishes at once', () => {
    const el = {};
    const run = vi.fn(() => undefined);
    for (let i = 0; i < 3; i++) expect(runLocked(el, run)).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('does not block another element, nor a node that replaced the locked one', async () => {
    const locked = {};
    const p = pending();
    runLocked(locked, () => p.promise);
    const other = vi.fn(() => pending().promise);
    runLocked({}, other);
    runLocked({}, other);
    expect(other).toHaveBeenCalledTimes(2);
    p.resolve(true);
    await settle();
  });

  it('stays free when the handler throws at once', () => {
    const el = {};
    const run = vi.fn(() => {
      throw new Error('kaputt');
    });
    expect(() => runLocked(el, run)).toThrow('kaputt');
    expect(() => runLocked(el, run)).toThrow('kaputt');
    expect(run).toHaveBeenCalledTimes(2);
  });
});
