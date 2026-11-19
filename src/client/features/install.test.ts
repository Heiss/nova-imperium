import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { clientFeature } from './install.ts';
import { fakeCtx } from './test-ctx.ts';

type El = { hidden: boolean };
let button: El;
let offer: El;
let winListeners: Record<string, (e: unknown) => void>;
let mobile: { matches: boolean; addEventListener: () => void };
let standalone: { matches: boolean; addEventListener: () => void };
let storage: {
  getItem: () => string | null;
  setItem: ReturnType<typeof vi.fn>;
};
let nav: { standalone?: boolean };

const build = (ctx = fakeCtx()) => clientFeature.acts(ctx);
const offered = (prompt = vi.fn(async () => undefined)) => {
  const event = { preventDefault: vi.fn(), prompt };
  winListeners.beforeinstallprompt!(event);
  return event;
};

beforeEach(() => {
  button = { hidden: false };
  offer = { hidden: false };
  winListeners = {};
  mobile = { matches: true, addEventListener: vi.fn() };
  standalone = { matches: false, addEventListener: vi.fn() };
  storage = { getItem: () => null, setItem: vi.fn() };
  nav = {};
  vi.stubGlobal('document', {
    querySelector: (sel: string) =>
      sel === '#pwa-install' ? button : sel === '#pwa-offer' ? offer : null,
  });
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      winListeners[type] = fn;
    },
  });
  vi.stubGlobal('matchMedia', (q: string) =>
    q.includes('standalone') ? standalone : mobile,
  );
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', nav);
  client.ui.view = 'overview';
});
afterEach(() => vi.unstubAllGlobals());

describe('the places that offer the installation', () => {
  it('hides the button until the browser offers one, shows the offer on a phone', () => {
    build();
    expect(button.hidden).toBe(true);
    expect(offer.hidden).toBe(false);
  });

  it('shows the button once the browser offers an installation, and stops its own dialog', () => {
    build();
    const event = offered();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(button.hidden).toBe(false);
  });

  it('hides both where the app is installed already', () => {
    standalone.matches = true;
    build();
    offered();
    expect(button.hidden).toBe(true);
    expect(offer.hidden).toBe(true);
  });

  it('hides both for the iOS home screen app, and the offer on a desktop', () => {
    nav.standalone = true;
    build();
    expect([button.hidden, offer.hidden]).toEqual([true, true]);
    nav.standalone = false;
    mobile.matches = false;
    build();
    expect(offer.hidden).toBe(true);
  });

  it('hides both once the browser says the app was installed', () => {
    build();
    offered();
    winListeners.appinstalled!({});
    expect([button.hidden, offer.hidden]).toEqual([true, true]);
  });

  it('keeps the offer hidden that the player dismissed on this device before', () => {
    storage.getItem = () => '1';
    build();
    expect(offer.hidden).toBe(true);
  });

  it('shows the offer when the storage cannot be read', () => {
    storage.getItem = () => {
      throw new Error('blocked');
    };
    build();
    expect(offer.hidden).toBe(false);
  });

  it('shows them again after a render of the help page only', () => {
    build();
    offer.hidden = true;
    clientFeature.afterRender();
    expect(offer.hidden).toBe(true);
    client.ui.view = 'help';
    clientFeature.afterRender();
    expect(offer.hidden).toBe(false);
  });
});

describe('dismissing the offer', () => {
  it('hides it and remembers it on this device', () => {
    build().dismissInstall();
    expect(offer.hidden).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      'nova.pwa.install-dismissed',
      '1',
    );
  });

  it('hides it for this tab even when the storage cannot be written', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('blocked');
    });
    build().dismissInstall();
    expect(offer.hidden).toBe(true);
  });
});

describe('„App installieren“', () => {
  it('shows how to install by hand while the browser offers nothing', async () => {
    const ctx = fakeCtx();
    await build(ctx).installApp();
    expect(vi.mocked(ctx.modal).mock.calls[0]![0]).toContain(
      'Zum Home-Bildschirm',
    );
  });

  it('opens the dialog of the browser once, and hides the button', async () => {
    const ctx = fakeCtx();
    const acts = build(ctx);
    const prompt = vi.fn(async () => undefined);
    offered(prompt);
    await acts.installApp();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(button.hidden).toBe(true);
    expect(ctx.modal).not.toHaveBeenCalled();
    await acts.installApp();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(ctx.modal).toHaveBeenCalledTimes(1);
  });

  it('sends the player to the menu of the browser when the dialog fails', async () => {
    const ctx = fakeCtx();
    const acts = build(ctx);
    offered(
      vi.fn(async () => {
        throw new Error('no');
      }),
    );
    await acts.installApp();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Bitte installiere die App über das Browsermenü.',
      true,
    );
  });
});
