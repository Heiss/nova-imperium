// The estimated active play time in the browser (#232) and its box in „Hilfe &
// Optionen“ (#231, okf/features/own-activity.md). The measurement is the
// tracker of logic/playtime.ts; this module listens to the page for it and
// sends its reports. The page is only listened to: no key, no position and
// no scroll offset is read. Rendering, the state refresh and the countdowns
// are no interaction, so they never reach the tracker.
import type { OwnActivity } from '../../core/playtime.ts';
import { $ } from '../dom.ts';
import {
  OWN_ACTIVITY_FAILED,
  ownActivityHTML,
} from '../logic/own-activity.ts';
import { createTracker, type Env, type Tracker } from '../logic/playtime.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

/** The numbers of the box are asked for again after this long [V]. */
const STALE_MS = 30_000;

/** The parts of the page the listening needs; a test passes its own. */
export interface PageDoc {
  visibilityState: string;
  hasFocus: () => boolean;
  addEventListener: (
    type: string,
    fn: (e: Event) => void,
    options?: AddEventListenerOptions,
  ) => void;
}
export interface PageWin {
  addEventListener: (type: string, fn: (e: Event) => void) => void;
}

/**
 * Feeds the tracker from the page: a trusted click, key or scroll is an
 * interaction (a scroll only notes the time, so a storm of them sends
 * nothing), and the page is in the foreground while it is visible and has
 * the focus. Leaving the page counts as leaving the foreground.
 */
export function attach(doc: PageDoc, win: PageWin, tracker: Tracker): void {
  const interaction = (e: Event): void => {
    if (e.isTrusted) tracker.interaction();
  };
  const sync = (): void =>
    tracker.foreground(doc.visibilityState === 'visible' && doc.hasFocus());
  const options = { capture: true, passive: true };
  doc.addEventListener('click', interaction, options);
  doc.addEventListener('keydown', interaction, options);
  doc.addEventListener('scroll', interaction, options);
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('focus', sync);
  win.addEventListener('blur', sync);
  win.addEventListener('pageshow', sync);
  win.addEventListener('pagehide', () => tracker.foreground(false));
}

/** The environment of the real page; the report goes out without waiting for the answer. */
const pageEnv: Env = {
  now: () => performance.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  send: (report) => {
    // `keepalive` lets the last report of a closing page still leave; a lost
    // one only shortens the estimate, so nothing is retried.
    void fetch('/api/playtime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => undefined);
  },
  // Signed out, and in vacation mode, where nothing is recorded (#223).
  enabled: () => !!client.game && client.game.me.vacation === null,
};

let shown: { at: number; data: OwnActivity } | null = null;
let loading = false;

/** Fills the box from the last answer and asks again when it is old or `force`. */
async function showOwnActivity(
  api: (url: string) => Promise<Record<string, unknown>>,
  force = false,
): Promise<void> {
  const box = $('#own-activity');
  if (!box) return;
  if (shown) box.innerHTML = ownActivityHTML(shown.data);
  if (loading || (!force && shown && Date.now() - shown.at < STALE_MS)) return;
  loading = true;
  try {
    const data = (await api('/api/own-activity')) as unknown as OwnActivity;
    shown = { at: Date.now(), data };
    const now = $('#own-activity');
    if (now) now.innerHTML = ownActivityHTML(data);
  } catch {
    const now = $('#own-activity');
    if (now && !shown) now.textContent = OWN_ACTIVITY_FAILED;
  } finally {
    loading = false;
  }
}

let ask: ((url: string) => Promise<Record<string, unknown>>) | null = null;

export const clientFeature = {
  acts: (ctx) => {
    ask = (url) => ctx.api(url);
    attach(
      document,
      window,
      createTracker(
        pageEnv,
        crypto.randomUUID(),
        document.visibilityState === 'visible' && document.hasFocus(),
      ),
    );
    return { reloadOwnActivity: () => showOwnActivity(ask!, true) };
  },
  afterRender: () => {
    if (client.ui.view === 'help' && ask) void showOwnActivity(ask);
  },
} satisfies ClientFeature;
