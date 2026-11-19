import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DAY_MS } from './activity.ts';
import {
  HEARTBEAT_MS,
  IDLE_MS,
  SESSION_GAP_MS,
  type Interval,
  type Last,
  type Report,
  type Verdict,
  activeMs,
  dailyMs,
  judge,
  readReport,
  sessionOf,
  union,
  utcDay,
} from './playtime.ts';

const PAGE = 'page-0001';
const report = (over: Partial<Report> = {}): Report => ({
  instance: PAGE,
  seq: 1,
  state: 'active',
  since: HEARTBEAT_MS,
  ...over,
});
const last = (over: Partial<Last> = {}): Last => ({
  seq: 0,
  state: 'active',
  end: 1000,
  opened: 0,
  beats: 0,
  ...over,
});

describe('the values decided in #232', () => {
  it('are 30 s, 60 s and 30 minutes', () => {
    expect(HEARTBEAT_MS).toBe(30_000);
    expect(IDLE_MS).toBe(60_000);
    expect(SESSION_GAP_MS).toBe(30 * 60_000);
  });
});

describe('readReport', () => {
  it('reads a start, a heartbeat and the end of an interval', () => {
    expect(
      readReport({ instance: PAGE, seq: 0, state: 'active', since: null }),
    ).toEqual({ instance: PAGE, seq: 0, state: 'active', since: null });
    expect(
      readReport({ instance: PAGE, seq: 3, state: 'inactive', since: 1200 }),
    ).toEqual({ instance: PAGE, seq: 3, state: 'inactive', since: 1200 });
    expect(
      readReport({ instance: PAGE, seq: 4, state: 'background', since: 0 }),
    ).toMatchObject({ state: 'background', since: 0 });
    // A page measures with performance.now(): the fraction is rounded away.
    expect(
      readReport({ instance: PAGE, seq: 5, state: 'active', since: 1234.567 }),
    ).toMatchObject({ since: 1235 });
  });

  it.each([
    ['no instance', { seq: 0, state: 'active', since: null }],
    ['a short instance', { instance: 'abc', seq: 0, state: 'active' }],
    [
      'an instance with a path',
      { instance: '../../etc/passwd', seq: 0, state: 'active', since: 1 },
    ],
    [
      'a negative seq',
      { instance: PAGE, seq: -1, state: 'active', since: null },
    ],
    [
      'a fractional seq',
      { instance: PAGE, seq: 1.5, state: 'active', since: null },
    ],
    ['an unknown state', { instance: PAGE, seq: 0, state: 'idle', since: 1 }],
    [
      'a start that is not active',
      { instance: PAGE, seq: 0, state: 'background', since: null },
    ],
    [
      'a negative duration',
      { instance: PAGE, seq: 0, state: 'active', since: -1 },
    ],
    [
      'a text as duration',
      { instance: PAGE, seq: 0, state: 'active', since: '30' },
    ],
    [
      'an infinite duration',
      { instance: PAGE, seq: 0, state: 'active', since: Infinity },
    ],
    ['a missing duration', { instance: PAGE, seq: 0, state: 'active' }],
  ])('refuses %s', (_name, body) => {
    expect(readReport(body as Record<string, unknown>)).toBeNull();
  });
});

describe('judge', () => {
  it('lets the first report of an interval earn no time', () => {
    expect(judge(report({ seq: 0, since: null }), null, 5000)).toEqual({
      accept: true,
      reason: 'start',
      start: 5000,
      end: 5000,
    });
  });

  it('credits a heartbeat with the time since the last report, at most 30 s', () => {
    const l = last({ end: 1000 });
    expect(judge(report({ since: 20_000 }), l, 21_000)).toEqual({
      accept: true,
      reason: 'heartbeat',
      start: 1000,
      end: 21_000,
    });
    // A claim above the heartbeat is cut, not believed.
    expect(judge(report({ since: 55_000 }), l, 41_000)).toMatchObject({
      start: 11_000,
      end: 41_000,
    });
    // A claim above the time the server has seen is cut to that time.
    expect(judge(report({ since: 30_000 }), l, 11_000)).toMatchObject({
      start: 1000,
      end: 11_000,
    });
  });

  it('ends an interval at the change of state, with the confirmed rest', () => {
    const l = last({ end: 1000 });
    expect(
      judge(report({ state: 'inactive', since: 12_000 }), l, 13_000),
    ).toEqual({ accept: true, reason: 'idle', start: 1000, end: 13_000 });
    expect(judge(report({ state: 'background', since: 0 }), l, 13_000)).toEqual(
      { accept: true, reason: 'background', start: 13_000, end: 13_000 },
    );
  });

  it('ignores a repeated, an older and an out-of-order report', () => {
    const l = last({ seq: 5 });
    expect(judge(report({ seq: 5 }), l, 10_000)).toEqual({ accept: false });
    expect(judge(report({ seq: 4 }), l, 10_000)).toEqual({ accept: false });
    expect(judge(report({ seq: 6 }), l, 10_000).accept).toBe(true);
  });

  it('never bridges a gap: a heartbeat after more than the timeout starts a new interval', () => {
    const l = last({ end: 0 });
    expect(judge(report({ since: 30_000 }), l, IDLE_MS)).toMatchObject({
      reason: 'heartbeat',
    });
    expect(judge(report({ since: 30_000 }), l, IDLE_MS + 1)).toEqual({
      accept: true,
      reason: 'start',
      start: IDLE_MS + 1,
      end: IDLE_MS + 1,
    });
    // A long absence earns nothing back, whatever the report claims.
    expect(judge(report({ since: 30_000 }), l, 3_600_000)).toMatchObject({
      start: 3_600_000,
      end: 3_600_000,
    });
  });

  it('starts a new interval after the end of the last one, and ignores an end without one', () => {
    const stopped = last({ state: 'inactive' });
    expect(judge(report({ since: 5000 }), stopped, 2000)).toMatchObject({
      reason: 'start',
      start: 2000,
      end: 2000,
    });
    expect(
      judge(report({ state: 'background', since: 5000 }), stopped, 2000),
    ).toEqual({ accept: false });
    expect(
      judge(report({ state: 'inactive', since: 5000 }), null, 2000),
    ).toEqual({ accept: false });
  });

  it('does not continue an interval when the server clock went back', () => {
    expect(
      judge(report({ since: 5000 }), last({ end: 10_000 }), 9000),
    ).toMatchObject({ reason: 'start' });
  });

  it('a start that has an interval open for more than a heartbeat closes nothing and opens a new one (a lost stop)', () => {
    expect(
      judge(
        report({ seq: 1, since: null }),
        last({ end: 1000 }),
        1000 + HEARTBEAT_MS,
      ),
    ).toMatchObject({ reason: 'start', start: 31_000, end: 31_000 });
  });
});

describe('union and activeMs', () => {
  const i = (start: number, end: number): Interval => ({ start, end });

  it('merges overlapping and touching intervals and drops empty ones', () => {
    expect(union([i(5, 9), i(0, 4), i(3, 6), i(20, 20), i(9, 12)])).toEqual([
      i(0, 12),
    ]);
    expect(union([i(0, 1), i(2, 3)])).toEqual([i(0, 1), i(2, 3)]);
  });

  it('counts a real second once however many pages report it', () => {
    expect(activeMs([i(0, 30_000), i(10_000, 40_000)], 0, 100_000)).toBe(
      40_000,
    );
  });

  it('clips to the window', () => {
    expect(activeMs([i(0, 100)], 20, 50)).toBe(30);
    expect(activeMs([i(0, 100)], 100, 200)).toBe(0);
    expect(activeMs([], 0, 10)).toBe(0);
  });

  it('does not change its input', () => {
    const input = [i(5, 9), i(0, 6)];
    union(input);
    expect(input).toEqual([i(5, 9), i(0, 6)]);
  });
});

describe('dailyMs', () => {
  it('splits an interval at UTC midnight', () => {
    const now = 10 * DAY_MS + 3600_000;
    const days = dailyMs(
      [{ start: 10 * DAY_MS - 15_000, end: 10 * DAY_MS + 15_000 }],
      now,
      3,
    );
    expect(days).toEqual([
      { day: 10 * DAY_MS, ms: 15_000 },
      { day: 9 * DAY_MS, ms: 15_000 },
      { day: 8 * DAY_MS, ms: 0 },
    ]);
  });

  it('runs the days from today back', () => {
    expect(utcDay(5 * DAY_MS + 1)).toBe(5 * DAY_MS);
    expect(dailyMs([], 5 * DAY_MS + 1, 2).map((d) => d.day)).toEqual([
      5 * DAY_MS,
      4 * DAY_MS,
    ]);
  });
});

describe('sessionOf', () => {
  const prev = { session: 3, end: 1_000_000, round: 2 };

  it('starts with session 1', () => {
    expect(sessionOf(null, 0, 1)).toBe(1);
  });

  it('goes on below a pause of 30 minutes and counts up at it (#232 Q1)', () => {
    expect(sessionOf(prev, prev.end + SESSION_GAP_MS - 1, 2)).toBe(3);
    expect(sessionOf(prev, prev.end + SESSION_GAP_MS, 2)).toBe(4);
  });

  it('counts up in a new round, however short the pause', () => {
    expect(sessionOf(prev, prev.end + 1, 3)).toBe(4);
  });
});

/** What the server credits for the reports of one page, as the browser sends them. */
function credited(reports: readonly (readonly [number, Report])[]): Interval[] {
  return storedRows(reports).map((row) => row.interval);
}

/** The last report as the table would give it after a row: the interval it opened and the rows since. */
const after = (
  prev: Last | null,
  r: Report,
  v: Extract<Verdict, { accept: true }>,
): Last => ({
  seq: r.seq,
  state: r.state,
  end: v.end,
  opened: v.reason === 'start' ? v.end : prev!.opened,
  beats: v.reason === 'start' ? 0 : prev!.beats + 1,
});

/** The rows the server stores for the reports of one page, with the reason of each. */
function storedRows(
  reports: readonly (readonly [number, Report])[],
): { at: number; reason: string; interval: Interval }[] {
  let state: Last | null = null;
  const out: { at: number; reason: string; interval: Interval }[] = [];
  for (const [at, r] of reports) {
    const v = judge(r, state, at);
    if (!v.accept) continue;
    out.push({
      at,
      reason: v.reason,
      interval: { start: v.start, end: v.end },
    });
    state = after(state, r, v);
  }
  return out;
}

describe('the estimate', () => {
  /** An isolated click: a start, two heartbeats' worth and the end at the timeout. */
  const click = (t0: number, seq: number) =>
    [
      [t0, report({ seq, since: null })],
      [t0 + 30_000, report({ seq: seq + 1, since: 30_000 })],
      [t0 + 60_000, report({ seq: seq + 2, state: 'inactive', since: 30_000 })],
    ] as const;

  it('credits two clicks four minutes apart with their timeouts, not with the four minutes (#232)', () => {
    const all = [...click(0, 0), ...click(240_000, 3)];
    const intervals = credited(all);
    expect(activeMs(intervals, 0, DAY_MS)).toBe(120_000);
    // The old method credited the whole gap of four minutes: 240 s.
    expect(activeMs(intervals, 0, DAY_MS)).toBeLessThan(240_000);
  });

  it('credits nothing for the time of a lost heartbeat and a lost stop', () => {
    // A start, one heartbeat, then silence for an hour and a start again.
    const intervals = credited([
      [0, report({ seq: 0, since: null })],
      [30_000, report({ seq: 1, since: 30_000 })],
      [3_630_000, report({ seq: 2, since: null })],
    ]);
    expect(activeMs(intervals, 0, DAY_MS)).toBe(30_000);
  });

  it('counts a continuous interaction of two minutes as two minutes', () => {
    const intervals = credited(
      [0, 1, 2, 3, 4].map(
        (n) =>
          [
            n * 30_000,
            report({ seq: n, since: n === 0 ? null : 30_000 }),
          ] as const,
      ),
    );
    expect(activeMs(intervals, 0, DAY_MS)).toBe(120_000);
  });

  it('never credits more than the real time, however the reports arrive', () => {
    const gen = fc.array(
      fc.record({
        at: fc.integer({ min: 0, max: 600_000 }),
        seq: fc.integer({ min: 0, max: 12 }),
        state: fc.constantFrom('active', 'inactive', 'background' as const),
        since: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: null }),
      }),
      { maxLength: 40 },
    );
    fc.assert(
      fc.property(gen, (list) => {
        const sorted = [...list].sort((a, b) => a.at - b.at);
        const reports = sorted.flatMap((e) => {
          const r = readReport({
            instance: PAGE,
            seq: e.seq,
            state: e.state,
            since: e.since,
          });
          return r ? [[e.at, r] as const] : [];
        });
        const intervals = credited(reports);
        const first = sorted[0]?.at ?? 0;
        const lastAt = sorted.at(-1)?.at ?? 0;
        expect(activeMs(intervals, 0, DAY_MS)).toBeLessThanOrEqual(
          lastAt - first,
        );
        for (const i of intervals)
          expect(i.end - i.start).toBeLessThanOrEqual(HEARTBEAT_MS);
      }),
      { numRuns: 200, seed: 232 },
    );
  });

  it('counts a replayed report once', () => {
    const a = report({ seq: 0, since: null });
    const b = report({ seq: 1, since: 30_000 });
    const once = credited([
      [0, a],
      [30_000, b],
    ]);
    const replayed = credited([
      [0, a],
      [30_000, b],
      [31_000, b],
      [32_000, a],
    ]);
    expect(replayed).toEqual(once);
  });

  it('counts two pages that are active at the same time once', () => {
    const second = (r: Report): Report => ({ ...r, instance: 'page-0002' });
    const first = credited([
      [0, report({ seq: 0, since: null })],
      [30_000, report({ seq: 1, since: 30_000 })],
    ]);
    const other = credited([
      [0, second(report({ seq: 0, since: null }))],
      [30_000, second(report({ seq: 1, since: 30_000 }))],
    ]);
    expect(activeMs([...first, ...other], 0, DAY_MS)).toBe(30_000);
  });
});

describe('the limit of rows per page (#232, owner, 2026-11-19)', () => {
  const beat = (seq: number, over: Partial<Report> = {}): Report =>
    report({ seq, since: HEARTBEAT_MS, ...over });

  it('stores an honest session exactly as before: a start, a heartbeat every 30 s, the stop at the timeout', () => {
    const all = [
      [0, report({ seq: 0, since: null })],
      [30_000, beat(1)],
      [60_000, beat(2)],
      [90_000, beat(3)],
      [120_000, beat(4, { state: 'inactive', since: 30_000 })],
    ] as const;
    expect(storedRows(all).map((r) => [r.at, r.reason])).toEqual([
      [0, 'start'],
      [30_000, 'heartbeat'],
      [60_000, 'heartbeat'],
      [90_000, 'heartbeat'],
      [120_000, 'idle'],
    ]);
    expect(activeMs(credited(all), 0, DAY_MS)).toBe(120_000);
  });

  it('stores a start and a stop 3 s later, and a second pair 2 s after that, as before', () => {
    const all = [
      [0, report({ seq: 0, since: null })],
      [3000, report({ seq: 1, state: 'background', since: 3000 })],
      [5000, report({ seq: 2, since: null })],
      [8000, report({ seq: 3, state: 'background', since: 3000 })],
    ] as const;
    const rows = storedRows(all);
    expect(rows.map((r) => r.reason)).toEqual([
      'start',
      'background',
      'start',
      'background',
    ]);
    expect(activeMs(credited(all), 0, DAY_MS)).toBe(6000);
  });

  it('loses no honest heartbeat to the jitter of the network: a page that beats every 30 s on its own clock, arrivals up to 5 s early or late', () => {
    const jitter = [-5000, 5000, -5000, 5000, 0, -4000, 5000, -5000, 3000];
    const all = [
      [0, report({ seq: 0, since: null })],
      ...jitter.map((j, k) => [(k + 1) * 30_000 + j, beat(k + 1)] as const),
    ] as const;
    expect(storedRows(all)).toHaveLength(all.length);
  });

  it('drops a flood: 100 heartbeats in one second store one row beyond the start', () => {
    const flood = Array.from(
      { length: 100 },
      (_, k) => [10_000 + k * 10, beat(k + 1)] as const,
    );
    const rows = storedRows([
      [10_000 - 1, report({ seq: 0, since: null })],
      ...flood,
    ]);
    expect(rows.map((r) => r.reason)).toEqual(['start', 'heartbeat']);
    // What the dropped reports claim is not credited later either: the credit stays the time that passed.
    expect(
      activeMs(
        rows.map((r) => r.interval),
        0,
        DAY_MS,
      ),
    ).toBeLessThanOrEqual(1000);
  });

  it('allows one more row for every heartbeat that passed, and no more', () => {
    // 100 reports every 10 s for 1000 s: at most one per whole 30 s since the start, plus one.
    const reports = Array.from(
      { length: 100 },
      (_, k) => [(k + 1) * 10_000, beat(k + 1)] as const,
    );
    const rows = storedRows([[0, report({ seq: 0, since: null })], ...reports]);
    expect(rows.length).toBeLessThanOrEqual(
      1 + 1 + Math.floor(1_000_000 / HEARTBEAT_MS),
    );
    expect(rows.length).toBeGreaterThan(30);
  });

  it('drops a flood of starts: one row, the next only after a heartbeat', () => {
    const starts = Array.from(
      { length: 100 },
      (_, k) => [k * 10, report({ seq: k, since: null })] as const,
    );
    expect(storedRows(starts)).toHaveLength(1);
    expect(
      storedRows([
        ...starts,
        [HEARTBEAT_MS + 990, report({ seq: 100, since: null })],
      ]),
    ).toHaveLength(2);
  });

  it('never limits the report that ends an interval, and an interval has one', () => {
    const all = [
      [0, report({ seq: 0, since: null })],
      [10, beat(1)],
      [20, beat(2)],
      [30, report({ seq: 3, state: 'background', since: 30 })],
      [40, report({ seq: 4, state: 'background', since: 30 })],
      [50, report({ seq: 5, state: 'inactive', since: 30 })],
    ] as const;
    expect(storedRows(all).map((r) => r.reason)).toEqual([
      'start',
      'heartbeat',
      'background',
    ]);
  });

  it('drops a report without changing anything, so a later one is judged against the same last report', () => {
    const l = last({ end: 10_000, opened: 10_000, beats: 1 });
    expect(judge(beat(2), l, 10_100)).toEqual({ accept: false });
    expect(judge(beat(3), l, 10_000 + HEARTBEAT_MS)).toMatchObject({
      accept: true,
      reason: 'heartbeat',
      start: 10_000,
    });
  });

  it('ties the count to the interval: a new start begins a new count', () => {
    const l = last({ end: 100_000, opened: 100_000, beats: 0 });
    expect(judge(beat(2), l, 100_050)).toMatchObject({ accept: true });
    expect(judge(beat(3), { ...l, beats: 1, end: 100_050 }, 100_100)).toEqual({
      accept: false,
    });
  });

  it('keeps the credit bounded by the real time under any flood and any mix of states', () => {
    const gen = fc.array(
      fc.record({
        at: fc.integer({ min: 0, max: 120_000 }),
        state: fc.constantFrom('active', 'inactive', 'background' as const),
        since: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: null }),
      }),
      { maxLength: 80 },
    );
    fc.assert(
      fc.property(gen, (list) => {
        const sorted = [...list].sort((a, b) => a.at - b.at);
        const reports = sorted.flatMap((e, seq) => {
          const r = readReport({
            instance: PAGE,
            seq,
            state: e.state,
            since: e.since,
          });
          return r ? [[e.at, r] as const] : [];
        });
        const rows = storedRows(reports);
        // Rows of a page: at most a start, a heartbeat per whole interval and a stop
        // per interval; the starts, one per heartbeat interval or one per stop.
        const starts = rows.filter((r) => r.reason === 'start').length;
        const stops = rows.filter(
          (r) => r.reason === 'idle' || r.reason === 'background',
        ).length;
        expect(stops).toBeLessThanOrEqual(starts);
        expect(
          activeMs(
            rows.map((r) => r.interval),
            0,
            DAY_MS,
          ),
        ).toBeLessThanOrEqual((sorted.at(-1)?.at ?? 0) - (sorted[0]?.at ?? 0));
      }),
      { numRuns: 200, seed: 2321 },
    );
  });
});
