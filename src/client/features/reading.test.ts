import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { fakeCtx } from './test-ctx.ts';
import { clientFeature } from './reading.ts';

const game = (readAt: number, reports: { time: number }[]) =>
  ({
    me: { id: 'anna', readAt },
    reports,
    guilds: null,
  }) as never;

beforeEach(() => {
  vi.useFakeTimers();
  client.ui.view = 'messages';
});
afterEach(() => {
  vi.useRealTimers();
  client.game = null;
  client.ui.view = 'overview';
});

describe('marking the reports as read', () => {
  it('tells the server after a moment, once, when a newer report is on the page', async () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx);
    client.game = game(5, [{ time: 9 }]);
    clientFeature.afterRender();
    clientFeature.afterRender();
    expect(ctx.act).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(ctx.act).toHaveBeenCalledTimes(1);
    expect(ctx.act).toHaveBeenCalledWith('read');
    // After the answer the next newer report is told again.
    clientFeature.afterRender();
    await vi.advanceTimersByTimeAsync(600);
    expect(ctx.act).toHaveBeenCalledTimes(2);
  });

  it('says nothing when everything is read or the page is another', async () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx);
    client.game = game(9, [{ time: 9 }]);
    clientFeature.afterRender();
    client.game = game(0, [{ time: 9 }]);
    client.ui.view = 'overview';
    clientFeature.afterRender();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.act).not.toHaveBeenCalled();
  });

  it('does nothing without a game', async () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx);
    client.game = null;
    expect(() => clientFeature.afterRender()).not.toThrow();
    expect(ctx.act).not.toHaveBeenCalled();
  });
});
