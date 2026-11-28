// „Wache stellen“ in the browser (#440): „Wegschicken“ sends its fleet, and
// the checkbox „Keine Wachen annehmen“ saves one value at a time, the newest
// click last (CodeRabbit on #455).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { clientFeature } from './holding.ts';
import { fakeCtx } from './test-ctx.ts';

let change: (e: unknown) => void;

beforeEach(() => {
  vi.stubGlobal('document', {
    addEventListener: (type: string, fn: typeof change) => {
      if (type === 'change') change = fn;
    },
  });
  client.game = {} as GameState;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
  client.ui.holdChoice = undefined;
});

const box = (checked: boolean, chg = 'holdOption') => ({
  target: { dataset: { chg }, checked },
});

describe('„Wegschicken“ (#440)', () => {
  it('sends the action with the id of the fleet', async () => {
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).sendAway!({ id: 'f7' } as never);
    expect(ctx.act).toHaveBeenCalledWith('sendAway', { id: 'f7' });
  });
});

describe('the checkbox „Keine Wachen annehmen“ (#440)', () => {
  it('saves at once', async () => {
    const ctx = fakeCtx();
    clientFeature.listen!(ctx);
    change(box(true));
    await vi.waitFor(() =>
      expect(ctx.act).toHaveBeenCalledWith('holdOption', { on: true }),
    );
    // Saved: the page renders the server's option again.
    await vi.waitFor(() => expect(ctx.render).toHaveBeenCalledTimes(1));
    expect(client.ui.holdChoice).toBeUndefined();
  });

  it('never ends on an older click when the answers come late', async () => {
    const answers: ((ok: boolean) => void)[] = [];
    const ctx = fakeCtx({
      act: vi.fn(() => new Promise<boolean>((r) => answers.push(r))) as never,
    });
    clientFeature.listen!(ctx);
    change(box(true));
    change(box(false));
    expect(ctx.act).toHaveBeenCalledTimes(1);
    expect(client.ui.holdChoice).toBe(false);
    answers.shift()!(true);
    await vi.waitFor(() => expect(ctx.act).toHaveBeenCalledTimes(2));
    // The newest click stays shown while its save runs.
    expect(client.ui.holdChoice).toBe(false);
    expect(vi.mocked(ctx.act).mock.calls).toEqual([
      ['holdOption', { on: true }],
      ['holdOption', { on: false }],
    ]);
    answers.shift()!(true);
  });

  it('sets the box to the option of the server after a refused save, which renders the same value as before (PR #469)', async () => {
    client.game = { holdsRefused: false } as GameState;
    const ctx = fakeCtx({ act: vi.fn(async () => false) as never });
    clientFeature.listen!(ctx);
    const e = box(true);
    change(e);
    await vi.waitFor(() => expect(ctx.render).toHaveBeenCalledTimes(1));
    expect(e.target.checked).toBe(false);
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('keeps the box ticked after a save the server took (PR #469)', async () => {
    const ctx = fakeCtx({
      act: vi.fn(async () => {
        client.game = { holdsRefused: true } as GameState;
        return true;
      }) as never,
    });
    clientFeature.listen!(ctx);
    const e = box(true);
    change(e);
    await vi.waitFor(() => expect(ctx.render).toHaveBeenCalledTimes(1));
    expect(e.target.checked).toBe(true);
  });

  it('shows a save that threw as an error, renders and leaves the box alone when signed out meanwhile (PR #469)', async () => {
    const error = new Error('Keine Verbindung.');
    const ctx = fakeCtx({
      act: vi.fn(async () => {
        client.game = null;
        throw error;
      }) as never,
    });
    clientFeature.listen!(ctx);
    const e = box(true);
    change(e);
    await vi.waitFor(() => expect(ctx.render).toHaveBeenCalledTimes(1));
    expect(ctx.toast).toHaveBeenCalledWith('Keine Verbindung.', error);
    expect(e.target.checked).toBe(true);
    expect(client.ui.holdChoice).toBeUndefined();
  });

  it('ignores other fields and a signed-out page', () => {
    const ctx = fakeCtx();
    clientFeature.listen!(ctx);
    change(box(true, 'push'));
    client.game = null;
    change(box(true));
    expect(ctx.act).not.toHaveBeenCalled();
  });
});
