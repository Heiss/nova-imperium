import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnActivity } from '../../core/playtime.ts';
import { OWN_ACTIVITY_FAILED } from '../logic/own-activity.ts';
import type { Tracker } from '../logic/playtime.ts';
import { attach, type PageDoc, type PageWin, sendReport } from './playtime.ts';
import { fakeCtx } from './test-ctx.ts';

type Listener = (e: Event) => void;

function page() {
  const docL: Record<string, { fn: Listener; options?: unknown }> = {};
  const winL: Record<string, Listener> = {};
  const doc = {
    visibilityState: 'visible',
    focused: true,
    hasFocus() {
      return this.focused;
    },
    addEventListener: (type: string, fn: Listener, options?: unknown) => {
      docL[type] = { fn, options };
    },
  };
  const win: PageWin = {
    addEventListener: (type, fn) => {
      winL[type] = fn;
    },
  };
  const tracker: Tracker & Record<string, ReturnType<typeof vi.fn>> = {
    interaction: vi.fn(),
    foreground: vi.fn(),
    state: vi.fn(),
  } as never;
  attach(doc as PageDoc, win, tracker);
  return { doc, docL, winL, tracker };
}

const trusted = { isTrusted: true } as Event;
const synthetic = { isTrusted: false } as Event;

describe('listening to the page for the tracker', () => {
  it('counts a trusted click, key and scroll, in the capture phase and passively', () => {
    const { docL, tracker } = page();
    for (const type of ['click', 'keydown', 'scroll']) {
      expect(docL[type]!.options).toEqual({ capture: true, passive: true });
      docL[type]!.fn(trusted);
    }
    expect(tracker.interaction).toHaveBeenCalledTimes(3);
  });

  it('ignores an event a script made', () => {
    const { docL, tracker } = page();
    for (const type of ['click', 'keydown', 'scroll'])
      docL[type]!.fn(synthetic);
    expect(tracker.interaction).not.toHaveBeenCalled();
  });

  it('is in the foreground while visible and focused', () => {
    const { doc, docL, winL, tracker } = page();
    docL.visibilitychange!.fn(trusted);
    expect(tracker.foreground).toHaveBeenLastCalledWith(true);
    doc.visibilityState = 'hidden';
    docL.visibilitychange!.fn(trusted);
    expect(tracker.foreground).toHaveBeenLastCalledWith(false);
    doc.visibilityState = 'visible';
    doc.focused = false;
    winL.blur!(trusted);
    expect(tracker.foreground).toHaveBeenLastCalledWith(false);
    doc.focused = true;
    winL.focus!(trusted);
    expect(tracker.foreground).toHaveBeenLastCalledWith(true);
    winL.pageshow!(trusted);
    expect(tracker.foreground).toHaveBeenLastCalledWith(true);
  });

  it('leaves the foreground when the page is left', () => {
    const { winL, tracker } = page();
    winL.pagehide!(trusted);
    expect(tracker.foreground).toHaveBeenLastCalledWith(false);
  });
});

const sample: OwnActivity = {
  method: 1,
  now: 1_700_000_000_000,
  since: 1_699_000_000_000,
  last: 1_699_999_000_000,
  round: 2,
  roundMs: 600_000,
  totalMs: 3_600_000,
  days: [{ day: 1_699_920_000_000, activeMs: 120_000, actions: 4 }],
};

describe('the box „Meine Aktivität & Spielzeit“', () => {
  // The module keeps the last answer: each test loads it anew.
  let clientFeature: (typeof import('./playtime.ts'))['clientFeature'];
  let client: (typeof import('../logic/state.svelte.ts'))['client'];
  let box: { innerHTML: string; textContent: string };
  let present: boolean;
  const registered: Listener[] = [];

  beforeEach(async () => {
    vi.resetModules();
    ({ clientFeature } = await import('./playtime.ts'));
    ({ client } = await import('../logic/state.svelte.ts'));
    box = { innerHTML: '', textContent: '' };
    present = true;
    registered.length = 0;
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      hasFocus: () => true,
      addEventListener: vi.fn(),
      querySelector: (sel: string) =>
        sel === '#own-activity' && present ? box : null,
    });
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    client.ui.view = 'help';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    client.ui.view = 'overview';
  });

  it("asks the server for the player's own numbers and shows them", async () => {
    const api = vi.fn(async () => sample as unknown as Record<string, unknown>);
    const ctx = fakeCtx({ api });
    clientFeature.listen!(ctx);
    const feature = clientFeature.acts(ctx);
    await feature.reloadOwnActivity!();
    expect(api).toHaveBeenCalledWith('/api/own-activity');
    expect(box.innerHTML).toContain('Geschätzte aktive Spielzeit');
    expect(box.innerHTML).toContain('10 Min.');
  });

  it('shows the last answer at once after a render and asks again only when it is old', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const api = vi.fn(async () => sample as unknown as Record<string, unknown>);
    const ctx = fakeCtx({ api });
    clientFeature.listen!(ctx);
    const feature = clientFeature.acts(ctx);
    await feature.reloadOwnActivity!();
    api.mockClear();
    box.innerHTML = '';
    clientFeature.afterRender();
    expect(box.innerHTML).toContain('Heute');
    expect(api).not.toHaveBeenCalled();
    vi.setSystemTime(1_000_000 + 30_000);
    clientFeature.afterRender();
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  });

  it('does nothing outside the options, and without the box', async () => {
    const api = vi.fn(async () => sample as unknown as Record<string, unknown>);
    const ctx = fakeCtx({ api });
    clientFeature.listen!(ctx);
    const feature = clientFeature.acts(ctx);
    client.ui.view = 'overview';
    clientFeature.afterRender();
    present = false;
    await feature.reloadOwnActivity!();
    expect(api).not.toHaveBeenCalled();
  });

  it('says so when the numbers cannot be reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000_000_000);
    const api = vi.fn(async () => {
      throw new Error('offline');
    });
    const ctx = fakeCtx({ api });
    clientFeature.listen!(ctx);
    const feature = clientFeature.acts(ctx);
    await feature.reloadOwnActivity!();
    expect(box.textContent).toBe(OWN_ACTIVITY_FAILED);
  });
});

describe('sending a report', () => {
  const report = {
    instance: 'a',
    seq: 3,
    state: 'active',
    since: 1000,
  } as const;

  it('posts the report as JSON with keepalive and reads the answer to its end', async () => {
    const text = vi.fn(async () => '{"ok":true}');
    const doFetch = vi.fn(async () => ({ text }) as unknown as Response);
    await sendReport(doFetch, report);
    expect(doFetch).toHaveBeenCalledWith('/api/playtime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
      credentials: 'same-origin',
      keepalive: true,
    });
    expect(text).toHaveBeenCalledTimes(1);
  });

  it('swallows a lost report and a body that cannot be read', async () => {
    await expect(
      sendReport(async () => Promise.reject(new Error('offline')), report),
    ).resolves.toBeUndefined();
    const broken = async () =>
      ({ text: () => Promise.reject(new Error('cut')) }) as unknown as Response;
    await expect(sendReport(broken, report)).resolves.toBeUndefined();
  });
});
