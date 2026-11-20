import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { fakeCtx } from './test-ctx.ts';

vi.mock('../push.ts', () => ({ disablePush: vi.fn(async () => undefined) }));
import { disablePush } from '../push.ts';
import { clientFeature, deleteAccount } from './account-delete.ts';

beforeEach(() => {
  client.game = { round: { guilds: true } } as never;
});
afterEach(() => {
  client.game = null;
  client.ui.auth = null;
  vi.clearAllMocks();
});

describe('deleting the account', () => {
  it('sends the password, then forgets the push, closes the dialog and shows the login', async () => {
    const ctx = fakeCtx();
    expect(await deleteAccount(ctx, 'geheim')).toBe(true);
    expect(ctx.api).toHaveBeenCalledWith('/api/account/delete', {
      password: 'geheim',
    });
    expect(disablePush).toHaveBeenCalledTimes(1);
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(client.game).toBeNull();
    expect(client.ui.auth).toBe('login');
    expect(ctx.render).toHaveBeenCalledWith(true);
    expect(ctx.toast).toHaveBeenCalledWith('Dein Account wurde gelöscht.');
  });

  it('keeps the game and says why when the server refuses', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Das Passwort stimmt nicht.');
      }),
    });
    expect(await deleteAccount(ctx, 'falsch')).toBe(false);
    expect(ctx.toast).toHaveBeenCalledWith('Das Passwort stimmt nicht.', true);
    expect(client.game).not.toBeNull();
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(disablePush).not.toHaveBeenCalled();
  });

  it('goes on when the push cannot be cancelled', async () => {
    vi.mocked(disablePush).mockRejectedValueOnce(new Error('offline'));
    const ctx = fakeCtx();
    expect(await deleteAccount(ctx, 'geheim')).toBe(true);
    expect(client.game).toBeNull();
  });

  it('opens the dialog as a component', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).deleteAccount!();
    expect(typeof vi.mocked(ctx.modal).mock.calls[0]![0]).toBe('function');
  });
});
