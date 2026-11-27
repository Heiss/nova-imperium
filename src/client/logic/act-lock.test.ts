// The lock of a clicked `data-act` element while its handler runs (#425), and
// of a submitted form (#428, 284a).
import { describe, expect, it, vi } from 'vitest';
import { runLocked, submitLocked } from './act-lock.ts';

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

describe('submitLocked (#428, 284a)', () => {
  /** A submit of a form with this id. */
  const submit = (form: { id: string } | null) => ({
    target: form as EventTarget | null,
    preventDefault: vi.fn(),
  });

  it('sends a form once while its handler runs, two quick Enter or a double click', async () => {
    const form = { id: 'chatform' };
    const p = pending();
    const send = vi.fn(() => p.promise);
    const first = submit(form);
    const second = submit(form);
    const done = submitLocked(first, { chatform: send });
    expect(submitLocked(second, { chatform: send })).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    // The second submit is still kept from the browser's default.
    expect(first.preventDefault).toHaveBeenCalledTimes(1);
    expect(second.preventDefault).toHaveBeenCalledTimes(1);
    p.resolve(true);
    await expect(done).resolves.toBe(true);
    submitLocked(submit(form), { chatform: send });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('is free again after a refusal or a network error', async () => {
    const form = { id: 'f' };
    const p = pending();
    const send = vi.fn(() => p.promise);
    const done = submitLocked(submit(form), { f: send });
    p.reject(new Error('Netzwerkfehler'));
    await expect(done).rejects.toThrow('Netzwerkfehler');
    await settle();
    const again = vi.fn(() => undefined);
    submitLocked(submit(form), { f: again });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('locks each form on its own', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const p = pending();
    const forms = { a: vi.fn(() => p.promise), b: vi.fn(() => p.promise) };
    submitLocked(submit(a), forms);
    submitLocked(submit(b), forms);
    expect(forms.a).toHaveBeenCalledTimes(1);
    expect(forms.b).toHaveBeenCalledTimes(1);
  });

  it('locks nothing for a handler without a promise', () => {
    const form = { id: 'f' };
    const run = vi.fn(() => undefined);
    expect(submitLocked(submit(form), { f: run })).toBeUndefined();
    submitLocked(submit(form), { f: run });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps the default of a form without a handler, an own property only', () => {
    const plain = submit({ id: 'other' });
    expect(submitLocked(plain, { f: vi.fn() })).toBeUndefined();
    expect(plain.preventDefault).not.toHaveBeenCalled();
    const inherited = submit({ id: 'toString' });
    expect(submitLocked(inherited, {})).toBeUndefined();
    expect(inherited.preventDefault).not.toHaveBeenCalled();
    const none = submit(null);
    expect(submitLocked(none, { '': vi.fn() })).toBeUndefined();
    expect(none.preventDefault).not.toHaveBeenCalled();
  });
});
