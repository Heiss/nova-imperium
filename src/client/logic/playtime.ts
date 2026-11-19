// The measurement of the active play time in the browser (#232,
// okf/features/own-activity.md): a small state machine with an injected
// clock, so a test moves the time by hand. It sends nothing but the state, a
// counter and the active milliseconds since its last report: no key, no
// position, no wall clock.
//
// States: `active` (visible and focused, a click, key or scroll within the
// last 60 s), `inactive` (60 s without one) and `background` (hidden or
// without focus). Only an interaction makes a page active; coming back to
// the foreground alone does not. A page that is active reports every 30 s
// and at every change of state; a heartbeat never moves the 60 s deadline.
// Scrolling is coalesced here: an event only notes the time, it sends
// nothing.
import {
  HEARTBEAT_MS,
  IDLE_MS,
  type PlaytimeState,
  type Report,
} from '../../core/playtime.ts';

/** What the tracker needs from the page; a test passes a clock it moves. */
export interface Env {
  /** A monotonic clock in milliseconds. */
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** Sends a report, best effort. */
  send: (report: Report) => void;
  /** False while nothing may be measured: signed out, or in vacation mode (#223). */
  enabled: () => boolean;
}

export interface Tracker {
  /** A trusted click, key or scroll in the page. */
  interaction: () => void;
  /** Whether the page is visible and focused. */
  foreground: (on: boolean) => void;
  /** The state now. */
  state: () => PlaytimeState;
}

export function createTracker(
  env: Env,
  instance: string,
  startsInForeground: boolean,
): Tracker {
  let state: PlaytimeState = startsInForeground ? 'inactive' : 'background';
  let seq = 0;
  let lastInteraction = 0;
  let lastReport = 0;
  let timer: unknown = null;

  const report = (to: PlaytimeState, since: number | null): void => {
    env.send({ instance, seq: seq++, state: to, since });
  };
  const clear = (): void => {
    if (timer !== null) env.clearTimer(timer);
    timer = null;
  };
  const deadline = (): number => lastInteraction + IDLE_MS;

  /** Ends the interval at the moment of the change, never later than the deadline. */
  const stop = (to: PlaytimeState): void => {
    clear();
    const end = Math.min(env.now(), deadline());
    report(to, Math.max(0, end - lastReport));
    state = to === 'background' ? 'background' : 'inactive';
  };

  const arm = (): void => {
    clear();
    const due = Math.min(lastReport + HEARTBEAT_MS, deadline());
    timer = env.setTimer(tick, Math.max(0, due - env.now()));
  };

  function tick(): void {
    timer = null;
    if (state !== 'active') return;
    const now = env.now();
    if (!env.enabled()) {
      // Signed out or in vacation: nothing is sent; the next interaction starts again.
      state = 'inactive';
      return;
    }
    if (now >= deadline()) return stop('inactive');
    if (now >= lastReport + HEARTBEAT_MS) {
      report('active', now - lastReport);
      lastReport = now;
    }
    arm();
  }

  return {
    interaction: () => {
      if (state === 'background' || !env.enabled()) return;
      const now = env.now();
      // A timer that ran late must not stretch an interval over the silence.
      if (state === 'active' && now >= deadline()) stop('inactive');
      lastInteraction = now;
      if (state === 'active') return;
      state = 'active';
      lastReport = now;
      report('active', null);
      arm();
    },
    foreground: (on) => {
      if (on) {
        if (state === 'background') state = 'inactive';
        return;
      }
      if (state === 'active') stop('background');
      else state = 'background';
    },
    state: () => state,
  };
}
