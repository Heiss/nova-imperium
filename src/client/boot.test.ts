// The links of an open tab (CodeRabbit of #417): a reset link and a link of
// a sign-in mail change only the hash; a late answer of an older reset link
// does not change the screen of a newer one, and a sign-in by the link of a
// mail ends a reset screen, so the state is taken.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api.ts', () => ({ api: vi.fn() }));
vi.mock('./render.ts', () => ({ render: vi.fn() }));
vi.mock('./toast.ts', () => ({ toast: vi.fn() }));
vi.mock('./news.ts', () => ({ forgetNews: vi.fn() }));
vi.mock('./sync.ts', () => ({ apply: vi.fn(), refresh: vi.fn() }));
import { api } from './api.ts';
import { watchLinks } from './boot.ts';
import { login } from './logic/login.ts';
import { client } from './logic/state.svelte.ts';
import { apply } from './sync.ts';
import { toast } from './toast.ts';

const OLD = 'a'.repeat(43);
const NEW = 'b'.repeat(43);

let onHash: () => void = () => undefined;
const location = { hash: '', pathname: '/', search: '' };

beforeEach(() => {
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', { replaceState: vi.fn() });
  vi.stubGlobal('window', {
    addEventListener: (_: string, f: () => void) => (onHash = f),
  });
  watchLinks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(api).mockReset();
  vi.mocked(apply).mockReset();
  login.resetToken = null;
  client.ui.auth = null;
  client.ui.resetApp = false;
  client.ui.resetChecked = false;
  client.game = null;
  vi.mocked(toast).mockReset();
});

/** Opens a link in the open tab. */
function open(hash: string): void {
  location.hash = hash;
  onHash();
}

const tick = () => new Promise((r) => setTimeout(r));

describe('the reset links of an open tab', () => {
  it('keeps the screen of the newer link when the check of an older one answers late', async () => {
    const answers = new Map<string, (v: unknown) => void>();
    vi.mocked(api).mockImplementation(
      (_url, body) =>
        new Promise((r) =>
          answers.set((body as { token: string }).token, r),
        ) as never,
    );
    open(`#reset=${OLD}`);
    open(`#reset=${NEW}`);
    expect(login.resetToken).toBe(NEW);
    answers.get(NEW)!({ app: false });
    await tick();
    answers.get(OLD)!({ app: true });
    await tick();
    expect(client.ui.resetApp).toBe(false);
    // The answer of the newer link counts.
    open(`#reset=${OLD}`);
    answers.get(OLD)!({ app: true });
    await tick();
    expect(client.ui.resetApp).toBe(true);
  });
});

describe('the check of a reset link (152a, #401)', () => {
  it('lets the form be sent after a check, with the code of the app if there is one', async () => {
    vi.mocked(api).mockResolvedValueOnce({ app: true });
    open(`#reset=${OLD}`);
    expect(client.ui.resetChecked).toBe(false);
    await tick();
    expect(api).toHaveBeenCalledWith('/api/password/reset/check', {
      token: OLD,
    });
    expect(client.ui.resetApp).toBe(true);
    expect(client.ui.resetChecked).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows a failed check as a note and keeps the form off', async () => {
    const failed = new Error('Dieser Link ist ungültig oder abgelaufen.');
    vi.mocked(api).mockRejectedValueOnce(failed);
    open(`#reset=${OLD}`);
    await tick();
    expect(toast).toHaveBeenCalledWith(failed.message, failed);
    expect(client.ui.resetChecked).toBe(false);
    expect(client.ui.resetApp).toBe(false);
    expect(client.ui.auth).toBe('reset');
    // The link opened again checks again.
    vi.mocked(api).mockResolvedValueOnce({ app: false });
    open(`#reset=${OLD}`);
    await tick();
    expect(client.ui.resetChecked).toBe(true);
  });

  it('says nothing of a failed check of an older link', async () => {
    const answers = new Map<string, (e: unknown) => void>();
    vi.mocked(api).mockImplementation(
      (_url, body) =>
        new Promise((_, reject) =>
          answers.set((body as { token: string }).token, reject),
        ) as never,
    );
    open(`#reset=${OLD}`);
    open(`#reset=${NEW}`);
    answers.get(OLD)!(new Error('alt'));
    await tick();
    expect(toast).not.toHaveBeenCalled();
    expect(client.ui.resetChecked).toBe(false);
  });
});

describe('the link of a sign-in mail in a tab with a reset screen', () => {
  it('ends the reset screen and takes the state when the code signs in', async () => {
    vi.mocked(api).mockResolvedValueOnce({ app: false });
    open(`#reset=${OLD}`);
    await tick();
    const state = { me: { id: 'anna' } };
    const seen: (string | null)[] = [];
    vi.mocked(apply).mockImplementation(() => void seen.push(login.resetToken));
    vi.mocked(api).mockResolvedValueOnce({ ok: true, state });
    open('#code=123456');
    await tick();
    expect(api).toHaveBeenLastCalledWith('/api/login/code', {
      code: '123456',
      link: true,
    });
    expect(apply).toHaveBeenCalledWith(state);
    expect(seen).toEqual([null]);
    expect(client.ui.auth).toBeNull();
  });

  it('keeps the reset screen when the code is refused', async () => {
    vi.mocked(api).mockResolvedValueOnce({ app: false });
    open(`#reset=${OLD}`);
    await tick();
    const refused = new Error('Der Anmeldecode ist ungültig oder abgelaufen.');
    vi.mocked(api).mockRejectedValueOnce(refused);
    open('#code=123456');
    await tick();
    expect(login.resetToken).toBe(OLD);
    expect(client.ui.auth).toBe('reset');
    expect(apply).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(refused.message, refused);
  });
});
