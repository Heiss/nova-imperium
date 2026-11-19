import { beforeEach, describe, expect, it } from 'vitest';
import type { Report } from '../../core/playtime.ts';
import { createTracker, type Env, type Tracker } from './playtime.ts';

/** A clock and timers that the test moves by hand. */
class Clock {
  t = 0;
  sent: Report[] = [];
  enabled = true;
  private timers = new Map<number, { at: number; fn: () => void }>();
  private next = 1;

  env: Env = {
    now: () => this.t,
    setTimer: (fn, ms) => {
      const id = this.next++;
      this.timers.set(id, { at: this.t + ms, fn });
      return id;
    },
    clearTimer: (h) => void this.timers.delete(h as number),
    send: (r) => void this.sent.push(r),
    enabled: () => this.enabled,
  };

  /** Moves the time on, running each timer at its moment. */
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      const due = [...this.timers].filter(([, x]) => x.at <= end);
      if (!due.length) break;
      const [id, timer] = due.sort((a, b) => a[1].at - b[1].at)[0]!;
      this.timers.delete(id);
      this.t = Math.max(this.t, timer.at);
      timer.fn();
    }
    this.t = end;
  }

  /** Moves the time on without running a timer, like a throttled tab. */
  skip(ms: number): void {
    this.t += ms;
  }

  get pending(): number {
    return this.timers.size;
  }
}

const brief = (r: Report) => [r.state, r.since];

let clock: Clock;
let tracker: Tracker;
beforeEach(() => {
  clock = new Clock();
  tracker = createTracker(clock.env, 'page-0001', true);
});

describe('the tracker of the active time', () => {
  it('sends nothing until an interaction, however long the page is open', () => {
    clock.advance(10 * 60_000);
    expect(clock.sent).toEqual([]);
    expect(tracker.state()).toBe('inactive');
  });

  it('starts with the first interaction, then reports every 30 s, then ends at the timeout', () => {
    tracker.interaction();
    expect(clock.sent.map(brief)).toEqual([['active', null]]);
    clock.advance(30_000);
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['active', 30_000],
    ]);
    clock.advance(30_000);
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['active', 30_000],
      ['inactive', 30_000],
    ]);
    expect(tracker.state()).toBe('inactive');
    // Nothing more is sent for an idle page.
    clock.advance(10 * 60_000);
    expect(clock.sent).toHaveLength(3);
    expect(clock.pending).toBe(0);
  });

  it('numbers the reports of the page one after the other', () => {
    tracker.interaction();
    clock.advance(60_000);
    expect(clock.sent.map((r) => r.seq)).toEqual([0, 1, 2]);
    expect(new Set(clock.sent.map((r) => r.instance))).toEqual(
      new Set(['page-0001']),
    );
  });

  it('ends exactly 60 s after the last interaction, which heartbeats do not move', () => {
    tracker.interaction();
    clock.advance(59_999);
    expect(tracker.state()).toBe('active');
    clock.advance(1);
    expect(tracker.state()).toBe('inactive');
  });

  it('keeps going while the player interacts and ends 60 s after the last one', () => {
    tracker.interaction();
    clock.advance(45_000);
    tracker.interaction();
    clock.advance(60_000);
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['active', 30_000],
      ['active', 30_000],
      ['active', 30_000],
      ['inactive', 15_000],
    ]);
  });

  it('coalesces a storm of scroll events into no report at all', () => {
    tracker.interaction();
    for (let i = 0; i < 5000; i++) tracker.interaction();
    expect(clock.sent).toHaveLength(1);
    expect(clock.pending).toBe(1);
  });

  it('stops at once in the background, with the time up to the change', () => {
    tracker.interaction();
    clock.advance(12_000);
    tracker.foreground(false);
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['background', 12_000],
    ]);
    expect(tracker.state()).toBe('background');
    expect(clock.pending).toBe(0);
  });

  it('does not resume by coming back, only by an interaction', () => {
    tracker.interaction();
    tracker.foreground(false);
    clock.advance(5 * 60_000);
    tracker.foreground(true);
    expect(tracker.state()).toBe('inactive');
    clock.advance(5 * 60_000);
    expect(clock.sent).toHaveLength(2);
    tracker.interaction();
    expect(clock.sent.at(-1)).toMatchObject({ state: 'active', since: null });
  });

  it('counts no interaction while the page is in the background', () => {
    tracker.foreground(false);
    tracker.interaction();
    expect(clock.sent).toEqual([]);
    expect(tracker.state()).toBe('background');
  });

  it('starts in the background when the page opens without the focus', () => {
    const hidden = createTracker(clock.env, 'page-0002', false);
    hidden.interaction();
    expect(clock.sent).toEqual([]);
    hidden.foreground(true);
    hidden.interaction();
    expect(clock.sent).toHaveLength(1);
  });

  it('sends nothing when an idle page goes to the background', () => {
    tracker.foreground(false);
    expect(clock.sent).toEqual([]);
    tracker.interaction();
    expect(clock.sent).toEqual([]);
  });

  it('does not credit the silence when a throttled timer runs late', () => {
    tracker.interaction();
    // The timers did not run for 75 s; the next click must not join the two.
    clock.skip(75_000);
    tracker.interaction();
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['inactive', 60_000],
      ['active', null],
    ]);
  });

  it('ends at the deadline, not at the late moment of a throttled timer', () => {
    tracker.interaction();
    clock.advance(30_000);
    clock.skip(40_000);
    clock.advance(1);
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['active', 30_000],
      ['inactive', 30_000],
    ]);
  });

  it('leaves the page in the background at the deadline when it hides late', () => {
    tracker.interaction();
    clock.skip(90_000);
    tracker.foreground(false);
    expect(clock.sent.at(-1)).toEqual({
      instance: 'page-0001',
      seq: 1,
      state: 'background',
      since: 60_000,
    });
  });

  it('sends nothing while signed out or in vacation mode', () => {
    clock.enabled = false;
    tracker.interaction();
    expect(clock.sent).toEqual([]);
    clock.enabled = true;
    tracker.interaction();
    clock.enabled = false;
    clock.advance(30_000);
    expect(clock.sent).toHaveLength(1);
    expect(tracker.state()).toBe('inactive');
    clock.enabled = true;
    tracker.interaction();
    expect(clock.sent).toHaveLength(2);
  });

  it('starts a new interval after the end of one', () => {
    tracker.interaction();
    clock.advance(60_000);
    clock.advance(200_000);
    tracker.interaction();
    expect(clock.sent.map(brief)).toEqual([
      ['active', null],
      ['active', 30_000],
      ['inactive', 30_000],
      ['active', null],
    ]);
  });
});
