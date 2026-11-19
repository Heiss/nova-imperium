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

/** The state machine of one page; see the head of the file. */
class PageTracker implements Tracker {
  private current: PlaytimeState;
  private seq = 0;
  private lastInteraction = 0;
  private lastReport = 0;
  private timer: unknown = null;
  private readonly env: Env;
  private readonly instance: string;

  constructor(env: Env, instance: string, foreground: boolean) {
    this.env = env;
    this.instance = instance;
    this.current = foreground ? 'inactive' : 'background';
  }

  state = (): PlaytimeState => this.current;

  private report(to: PlaytimeState, since: number | null): void {
    this.env.send({
      instance: this.instance,
      seq: this.seq++,
      state: to,
      since,
    });
  }

  private clear(): void {
    if (this.timer !== null) this.env.clearTimer(this.timer);
    this.timer = null;
  }

  private deadline(): number {
    return this.lastInteraction + IDLE_MS;
  }

  /** Ends the interval at the moment of the change, never later than the deadline. */
  private stop(to: PlaytimeState): void {
    this.clear();
    const end = Math.min(this.env.now(), this.deadline());
    this.report(to, Math.max(0, end - this.lastReport));
    this.current = to === 'background' ? 'background' : 'inactive';
  }

  private arm(): void {
    this.clear();
    const due = Math.min(this.lastReport + HEARTBEAT_MS, this.deadline());
    this.timer = this.env.setTimer(
      this.tick,
      Math.max(0, due - this.env.now()),
    );
  }

  private readonly tick = (): void => {
    this.timer = null;
    if (this.current !== 'active') return;
    const now = this.env.now();
    if (!this.env.enabled()) {
      // Signed out or in vacation: nothing is sent; the next interaction starts again.
      this.current = 'inactive';
      return;
    }
    if (now >= this.deadline()) return this.stop('inactive');
    if (now >= this.lastReport + HEARTBEAT_MS) {
      this.report('active', now - this.lastReport);
      this.lastReport = now;
    }
    this.arm();
  };

  interaction = (): void => {
    if (this.current === 'background' || !this.env.enabled()) return;
    const now = this.env.now();
    // A timer that ran late must not stretch an interval over the silence.
    if (this.current === 'active' && now >= this.deadline())
      this.stop('inactive');
    this.lastInteraction = now;
    if (this.current === 'active') return;
    this.current = 'active';
    this.lastReport = now;
    this.report('active', null);
    this.arm();
  };

  foreground = (on: boolean): void => {
    if (on) {
      if (this.current === 'background') this.current = 'inactive';
      return;
    }
    if (this.current === 'active') this.stop('background');
    else this.current = 'background';
  };
}

export const createTracker = (
  env: Env,
  instance: string,
  startsInForeground: boolean,
): Tracker => new PageTracker(env, instance, startsInForeground);
