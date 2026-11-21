// The features that listen on the document: producers (the share), options
// (the animations) and session-activity (the activity sample).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { fakeCtx } from './test-ctx.ts';
import { clientFeature as options } from './options.ts';
import { clientFeature as producers } from './producers.ts';
import { clientFeature as activity } from './session-activity.ts';

type Listener = (e: unknown) => void;
let listeners: Record<string, Listener[]>;
const fire = (type: string, event: unknown) =>
  (listeners[type] ?? []).forEach((l) => l(event));

beforeEach(() => {
  listeners = {};
  const storage = new Map<string, string>();
  vi.stubGlobal('document', {
    addEventListener: (type: string, l: Listener) =>
      (listeners[type] ??= []).push(l),
    visibilityState: 'visible',
    documentElement: { classList: { toggle: vi.fn() } },
  });
  vi.stubGlobal('localStorage', {
    setItem: (k: string, v: string) => storage.set(k, v),
    getItem: (k: string) => storage.get(k) ?? null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}')),
  );
  client.game = {} as never;
});
afterEach(() => {
  client.game = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the share of a producer', () => {
  it('sends the chosen percentage of that producer', () => {
    const ctx = fakeCtx();
    producers.listen!(ctx);
    fire('change', {
      target: { dataset: { chg: 'pct', k: 'metal' }, value: '90' },
    });
    expect(ctx.act).toHaveBeenCalledWith('pct', { key: 'metal', v: '90' });
  });

  it('ignores other changes and a signed-out page', () => {
    const ctx = fakeCtx();
    producers.listen!(ctx);
    fire('change', { target: { dataset: { chg: 'push' }, value: '1' } });
    client.game = null;
    fire('change', { target: { dataset: { chg: 'pct', k: 'm' }, value: '1' } });
    expect(ctx.act).not.toHaveBeenCalled();
  });
});

describe('the animations of the options', () => {
  it('switches the planets and remembers the choice on this device', () => {
    options.listen!();
    fire('change', { target: { id: 'o_anim', checked: false } });
    expect(client.ui.animations).toBe(false);
    expect(localStorage.getItem('nova.animations')).toBe('off');
    fire('change', { target: { id: 'o_anim', checked: true } });
    expect(client.ui.animations).toBe(true);
    expect(localStorage.getItem('nova.animations')).toBe('on');
  });

  it('lasts until the reload when the storage is not there', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    options.listen!();
    fire('change', { target: { id: 'o_anim', checked: false } });
    expect(client.ui.animations).toBe(false);
    client.ui.animations = true;
  });
});

describe('the activity sample', () => {
  const click = { isTrusted: true };

  it('tells the server at most every 10 seconds', () => {
    let now = 1000;
    vi.stubGlobal('performance', { now: () => now });
    activity.listen!();
    fire('click', click);
    now += 9000;
    fire('keydown', click);
    expect(fetch).toHaveBeenCalledTimes(1);
    now += 1000;
    fire('keydown', click);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores scripted events, hidden pages and signed-out players', () => {
    activity.listen!();
    fire('click', { isTrusted: false });
    (document as { visibilityState: string }).visibilityState = 'hidden';
    fire('click', click);
    (document as { visibilityState: string }).visibilityState = 'visible';
    client.game = null;
    fire('click', click);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('samples at once after a sign-out and a new sign-in', () => {
    vi.stubGlobal('performance', { now: () => 5000 });
    activity.listen!();
    fire('click', click);
    client.game = null;
    fire('click', click);
    client.game = {} as never;
    fire('click', click);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not mind a failing sample', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('x'))),
    );
    activity.listen!();
    expect(() => fire('click', click)).not.toThrow();
  });
});
