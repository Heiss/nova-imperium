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
    answers.shift()!(true);
    await vi.waitFor(() => expect(ctx.act).toHaveBeenCalledTimes(2));
    expect(vi.mocked(ctx.act).mock.calls).toEqual([
      ['holdOption', { on: true }],
      ['holdOption', { on: false }],
    ]);
    answers.shift()!(true);
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
