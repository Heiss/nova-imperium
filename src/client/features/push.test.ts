import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { disablePush, enablePush } from '../push.ts';
import { clientFeature } from './push.ts';
import { fakeCtx } from './test-ctx.ts';

vi.mock('../push.ts', () => ({
  enablePush: vi.fn(async () => undefined),
  disablePush: vi.fn(async () => undefined),
}));

let change: (e: unknown) => void;

beforeEach(() => {
  vi.mocked(enablePush).mockClear();
  vi.mocked(disablePush).mockClear();
  vi.stubGlobal('document', {
    addEventListener: (type: string, fn: typeof change) => {
      if (type === 'change') change = fn;
    },
  });
  client.game = { me: { pushOff: [] } } as unknown as GameState;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
  client.ui.pushChoice = undefined;
});

describe('Web Push on this device', () => {
  it('switches it on through the server and says so', async () => {
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).pushEnable();
    expect(enablePush).toHaveBeenCalledWith(ctx.api);
    expect(disablePush).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('Benachrichtigungen aktiviert.');
  });

  it('switches it off and says so', async () => {
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).pushDisable();
    expect(disablePush).toHaveBeenCalledWith(ctx.api);
    expect(ctx.toast).toHaveBeenCalledWith('Benachrichtigungen deaktiviert.');
  });

  it('shows the reason when the browser or the server refuses', async () => {
    vi.mocked(enablePush).mockRejectedValueOnce(new Error('Nicht verfügbar.'));
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).pushEnable();
    expect(ctx.toast).toHaveBeenCalledWith('Nicht verfügbar.', true);
  });
});

describe('the checkbox of a kind', () => {
  const box = (over: object) => ({
    target: {
      dataset: { chg: 'push', k: 'buildings' },
      checked: false,
      ...over,
    },
  });

  it('saves the kinds switched off and renders once the save is over', async () => {
    const ctx = fakeCtx();
    clientFeature.listen(ctx);
    change(box({}));
    await vi.waitFor(() => expect(ctx.render).toHaveBeenCalledTimes(1));
    expect(ctx.act).toHaveBeenCalledWith('pushOptions', { off: ['buildings'] });
  });

  it('ignores other fields and a signed-out page', () => {
    const ctx = fakeCtx();
    clientFeature.listen(ctx);
    change(box({ dataset: { chg: 'pct' } }));
    change({ target: {} });
    client.game = null;
    change(box({}));
    expect(ctx.act).not.toHaveBeenCalled();
  });
});
