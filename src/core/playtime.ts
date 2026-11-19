// The estimated active play time (#232, okf/features/own-activity.md): the
// rules of the measurement as pure functions. The browser reports its state
// changes and a heartbeat while it is active; the server accepts each report
// as an interval of active time, and the totals are derived from the
// accepted intervals on read, never stored (owner, 2026-11-16).
//
// The values are decided in #232 [E]: a heartbeat every 30 s while active, 60
// s without a click, a key or a scroll end the activity, a hidden or
// unfocused page stops it at once, and a new usage session starts after a
// pause of 30 minutes (Q1, owner, 2026-11-16).
import { DAY_MS } from './activity.ts';

/** The regular report of an active page, and the most time one report confirms. */
export const HEARTBEAT_MS = 30_000;
/** Time without a trusted click, key or scroll after which a page is inactive. */
export const IDLE_MS = 60_000;
/** A pause of this length ends a usage session (#232 Q1). */
export const SESSION_GAP_MS = 30 * 60_000;
/** The version of the method; every stored interval names the one that measured it. */
export const METHOD_VERSION = 1;

/**
 * The states of a page. Only `active` counts. `inactive`: visible and
 * focused, but 60 s without an interaction. `background`: hidden or without
 * focus.
 */
export const STATES = ['active', 'inactive', 'background'] as const;
export type PlaytimeState = (typeof STATES)[number];

/** Why an interval was accepted: the start of one, a heartbeat or the end of one. */
export type Reason = 'start' | 'heartbeat' | 'idle' | 'background';

/**
 * What a page sends. `since` is the active time in milliseconds since its
 * previous report on the page's own monotonic clock, up to the moment of
 * the state change; null for the first report of an interval, which earns no
 * time. Nothing else leaves the page: no key, no position, no wall clock.
 */
export interface Report {
  /** An identifier of the page, new on every load. */
  instance: string;
  /** Counts up with every report of the page; a repeated or older one adds nothing. */
  seq: number;
  state: PlaytimeState;
  since: number | null;
}

/** The last accepted report of a page, as the server stored it. */
export interface Last {
  seq: number;
  state: PlaytimeState;
  /** The end of its interval, on the server's clock. */
  end: number;
}

/** An interval of time on the server's clock, in milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/** What the server does with a report. */
export type Verdict =
  | { accept: false }
  | ({ accept: true; reason: Reason } & Interval);

const INSTANCE = /^[A-Za-z0-9_-]{8,36}$/;

/** The report in a request body, or null for anything that is not one. */
export function readReport(body: Record<string, unknown>): Report | null {
  const { instance, seq, state, since } = body;
  if (typeof instance !== 'string' || !INSTANCE.test(instance)) return null;
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0)
    return null;
  if (!STATES.includes(state as PlaytimeState)) return null;
  if (since === null) {
    // Only an active page starts an interval.
    return state === 'active' ? { instance, seq, state, since: null } : null;
  }
  if (typeof since !== 'number' || !Number.isFinite(since) || since < 0)
    return null;
  return { instance, seq, state: state as PlaytimeState, since };
}

/** The reason of an accepted report, from its state and whether it started an interval. */
const reasonOf = (state: PlaytimeState, started: boolean): Reason =>
  state === 'active'
    ? started
      ? 'start'
      : 'heartbeat'
    : state === 'inactive'
      ? 'idle'
      : 'background';

/**
 * What an arriving report is worth (#232, counting contract). The interval
 * it confirms ends now and is as long as the page claims, at most one
 * heartbeat, and never longer than the time since the page's last accepted
 * report, so no interval overlaps its predecessor. Rules:
 * - A report that is not newer than the page's last one is ignored: a
 *   retry or an out-of-order delivery adds no time twice.
 * - The first report of an interval earns no time. An active report that
 *   cannot continue one starts a new interval, never bridging the gap.
 * - An interval continues only if the page's last report was active and
 *   at most one inactivity timeout ago [V]: the page would have reported
 *   twice by then, so a longer gap is a lost connection, not activity.
 * - A report that ends an interval without one to end is ignored.
 */
export function judge(report: Report, last: Last | null, now: number): Verdict {
  if (last && report.seq <= last.seq) return { accept: false };
  const open =
    last !== null &&
    last.state === 'active' &&
    now >= last.end &&
    now - last.end <= IDLE_MS;
  if (report.since === null || !open) {
    if (report.state !== 'active') return { accept: false };
    return { accept: true, reason: 'start', start: now, end: now };
  }
  const credit = Math.min(report.since, HEARTBEAT_MS, now - last.end);
  return {
    accept: true,
    reason: reasonOf(report.state, false),
    start: now - credit,
    end: now,
  };
}

/** The intervals merged where they touch or overlap; the input need not be sorted. */
export function union(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Interval[] = [];
  for (const i of sorted) {
    const tail = out[out.length - 1];
    if (tail && i.start <= tail.end) tail.end = Math.max(tail.end, i.end);
    else out.push(i);
  }
  return out;
}

/** The time of the intervals inside the window [from, to), each real second once. */
export function activeMs(
  intervals: readonly Interval[],
  from: number,
  to: number,
): number {
  let sum = 0;
  for (const i of union(intervals)) {
    const lo = Math.max(i.start, from);
    const hi = Math.min(i.end, to);
    if (hi > lo) sum += hi - lo;
  }
  return sum;
}

/** The start of the UTC day of a time. */
export const utcDay = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;

/** The time of each of the `count` UTC days ending with the day of `now`, newest first. */
export function dailyMs(
  intervals: readonly Interval[],
  now: number,
  count: number,
): { day: number; ms: number }[] {
  const merged = union(intervals);
  const today = utcDay(now);
  return Array.from({ length: count }, (_, i) => {
    const day = today - i * DAY_MS;
    return { day, ms: activeMs(merged, day, day + DAY_MS) };
  });
}

/**
 * The number of the usage session of an interval that starts at `start`
 * (#232 Q1): the player's last session goes on unless 30 minutes passed
 * since its last interval, or the round changed, then a new one counts.
 */
export function sessionOf(
  previous: { session: number; end: number; round: number } | null,
  start: number,
  round: number,
): number {
  if (!previous) return 1;
  const gap = start - previous.end;
  return previous.round === round && gap < SESSION_GAP_MS
    ? previous.session
    : previous.session + 1;
}

/** One UTC day of the table: the estimated active time and the successful actions. */
export interface DayRow {
  day: number;
  activeMs: number;
  actions: number;
}

/** What a player sees of their own activity in the options (#231). */
export interface OwnActivity {
  /** The method of the measurement; a total of another one is no total of this. */
  method: number;
  /** The time of the server. */
  now: number;
  /** The first interval ever recorded for the account: „Erfasst seit“. */
  since: number | null;
  /** The end of the last interval of active time: „Zuletzt aktiv“. */
  last: number | null;
  /** The number of the running round. */
  round: number;
  /** The active time of the running round and of the whole account. */
  roundMs: number;
  totalMs: number;
  /** The last seven UTC days, today first. */
  days: DayRow[];
}
