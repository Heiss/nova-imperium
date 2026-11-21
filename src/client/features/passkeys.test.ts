import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { optionsForm } from '../logic/options-form.svelte.ts';
import { addPasskey } from '../passkeys.ts';
import { clientFeature } from './passkeys.ts';
import { fakeCtx } from './test-ctx.ts';

vi.mock('../passkeys.ts', () => ({ addPasskey: vi.fn(async () => undefined) }));

const list = { innerHTML: '' };
let confirm: ReturnType<typeof vi.fn>;
let present = true;

beforeEach(() => {
  list.innerHTML = '';
  present = true;
  confirm = vi.fn(() => true);
  vi.mocked(addPasskey).mockReset();
  vi.stubGlobal('window', { confirm });
  vi.stubGlobal('document', {
    querySelector: (sel: string) =>
      sel === '#passkey-list' && present
        ? list
        : sel === '#passkey-password'
          ? { value: 'geheim' }
          : null,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetForms();
});

const keys = (...created: number[]) =>
  vi.fn(async () => ({
    keys: created.map((c, i) => ({ id: `k${i}`, created: c })),
  }));

describe('the list of passkeys', () => {
  it('asks the server and lists each key with a button to remove it', async () => {
    const ctx = fakeCtx({ api: keys(1700000000000, 1700000100000) });
    await clientFeature.acts(ctx).listPasskeys();
    expect(ctx.api).toHaveBeenCalledWith('/api/passkeys/list', {});
    expect(list.innerHTML).toContain('data-act="removePasskey" data-id="k0"');
    expect(list.innerHTML).toContain('data-id="k1"');
    expect(list.innerHTML.match(/<li>/g)).toHaveLength(2);
  });

  it('says so when there is none', async () => {
    await clientFeature.acts(fakeCtx({ api: keys() })).listPasskeys();
    expect(list.innerHTML).toBe('<p>Keine Passkeys gespeichert.</p>');
  });

  it('writes nothing when the list is not on the page', async () => {
    present = false;
    await clientFeature.acts(fakeCtx({ api: keys(1) })).listPasskeys();
    expect(list.innerHTML).toBe('');
  });

  it('shows the refusal of the server', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Nein.');
      }),
    });
    await clientFeature.acts(ctx).listPasskeys();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Nein.',
      expect.objectContaining({ message: 'Nein.' }),
    );
  });
});

describe('removing a passkey', () => {
  it('asks first and does nothing when the player says no', async () => {
    confirm.mockReturnValueOnce(false);
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).removePasskey({ id: 'k0' });
    expect(confirm).toHaveBeenCalledWith('Diesen Passkey entfernen?');
    expect(ctx.api).not.toHaveBeenCalled();
  });

  it('removes it and lists the rest', async () => {
    const api = vi.fn(async (url: string) =>
      url === '/api/passkeys/list' ? { keys: [] } : {},
    );
    await clientFeature.acts(fakeCtx({ api })).removePasskey({ id: 'k0' });
    expect(api).toHaveBeenNthCalledWith(1, '/api/passkeys/remove', {
      id: 'k0',
    });
    expect(api).toHaveBeenNthCalledWith(2, '/api/passkeys/list', {});
  });

  it('shows the refusal of the server and does not list again', async () => {
    const api = vi.fn(async () => {
      throw new Error('Nicht erlaubt.');
    });
    const ctx = fakeCtx({ api });
    await clientFeature.acts(ctx).removePasskey({ id: 'k0' });
    expect(ctx.toast).toHaveBeenCalledWith(
      'Nicht erlaubt.',
      expect.objectContaining({ message: 'Nicht erlaubt.' }),
    );
    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe('the form of a new passkey', () => {
  it('adds the passkey with the password, clears the field and lists the keys', async () => {
    optionsForm.passkey = 'geheim';
    const ctx = fakeCtx({ api: keys(1) });
    await clientFeature.forms(ctx).passkeyform();
    expect(addPasskey).toHaveBeenCalledWith(ctx.api, 'geheim');
    // The field shows the state of the form (#332).
    expect(optionsForm.passkey).toBe('');
    expect(ctx.toast).toHaveBeenCalledWith('Passkey gespeichert.');
    expect(ctx.api).toHaveBeenCalledWith('/api/passkeys/list', {});
  });

  it('keeps the password and shows the error when the browser refuses', async () => {
    vi.mocked(addPasskey).mockRejectedValueOnce(new Error('Abgebrochen.'));
    optionsForm.passkey = 'geheim';
    const ctx = fakeCtx();
    await clientFeature.forms(ctx).passkeyform();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Abgebrochen.',
      expect.objectContaining({ message: 'Abgebrochen.' }),
    );
    expect(optionsForm.passkey).toBe('geheim');
    expect(ctx.setInput).not.toHaveBeenCalled();
    expect(ctx.api).not.toHaveBeenCalled();
  });
});
