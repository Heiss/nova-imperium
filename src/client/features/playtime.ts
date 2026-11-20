// The estimated active play time in the browser (#232) and its box in „Hilfe &
// Optionen“ (#231, okf/features/own-activity.md). The measurement is the
// tracker of logic/playtime.ts; this module listens to the page for it and
// sends its reports. The page is only listened to: no key, no position and
// no scroll offset is read. Rendering, the state refresh and the countdowns
// are no interaction, so they never reach the tracker.
import type { OwnActivity, Report } from '../../core/playtime.ts';
import { $ } from '../dom.ts';
import { OWN_ACTIVITY_FAILED, ownActivityHTML } from '../logic/own-activity.ts';
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

/**
 * Sends a report and reads the answer to its end. `keepalive` lets the last
 * report of a closing page still leave; a lost one only shortens the
 * estimate, so nothing is retried. The body is read because a response whose
 * body nobody reads keeps its request open in the browser (until a garbage
 * collection): every heartbeat then stood as a request that never ends, and a
 * test that waits for „networkidle“ waited for ever.
 */
export function sendReport(
  doFetch: (url: string, init: RequestInit) => Promise<Response>,
  report: Report,
): Promise<void> {
  return doFetch('/api/playtime', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
    credentials: 'same-origin',
    keepalive: true,
  })
    .then((response) => response.text())
    .then(
      () => undefined,
      () => undefined,
    );
}

/** The environment of the real page; the report goes out without waiting for the answer. */
const pageEnv: Env = {
  now: () => performance.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  send: (report) => {
    void sendReport((url, init) => fetch(url, init), report);
  },
  // Signed out, and in vacation mode, where nothing is recorded (#223).
  enabled: () => !!client.game && client.game.me.vacation === null,
};

let shown: { at: number; data: OwnActivity } | null = null;
let loading = false;

/** Puts the box's content in the place, when the box is on the page. */
function paint(html: string): void {
  const box = $('#own-activity');
  if (box) box.innerHTML = html;
}

/** Whether the last answer is recent enough for the box not to ask again. */
const fresh = (): boolean => !!shown && Date.now() - shown.at < STALE_MS;

type Ask = (url: string) => Promise<Record<string, unknown>>;

/** Asks for the numbers and shows them, or says that they are not reachable. */
async function loadOwnActivity(api: Ask): Promise<void> {
  loading = true;
  try {
    const data = (await api('/api/own-activity')) as unknown as OwnActivity;
    shown = { at: Date.now(), data };
    paint(ownActivityHTML(data));
  } catch {
    // The numbers of the last answer stay; without one the box says so.
    const box = $('#own-activity');
    if (!shown && box) box.textContent = OWN_ACTIVITY_FAILED;
  } finally {
    loading = false;
  }
}

/** Fills the box from the last answer and asks again when it is old or `force`. */
async function showOwnActivity(api: Ask, force = false): Promise<void> {
  if (!$('#own-activity')) return;
  if (shown) paint(ownActivityHTML(shown.data));
  if (loading || (!force && fresh())) return;
  await loadOwnActivity(api);
}

let ask: Ask | null = null;

export const clientFeature = {
  listen: (ctx) => {
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
  },
  acts: ({ api }) => ({
    reloadOwnActivity: () => showOwnActivity((url) => api(url), true),
  }),
  afterRender: () => {
    if (client.ui.view === 'help' && ask) void showOwnActivity(ask);
  },
} satisfies ClientFeature;
