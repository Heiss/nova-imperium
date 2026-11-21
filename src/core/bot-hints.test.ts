// The hints of #181: raw facts per UTC day since the switch-on, at most 30
// days back, newest first; no score and no threshold.
import { describe, expect, it } from 'vitest';
import {
  botHints,
  gapsOf,
  HINT_DAYS,
  hintsFrom,
  LIMIT_ACTION,
} from './bot-hints.ts';

const DAY = 86400000;
const D0 = 100 * DAY; // the start of a UTC day
const act = (time: number, action = 'build') => ({ time, action });

describe('the gaps between the actions of a day', () => {
  it('are the shortest, the median and the middle half, in seconds', () => {
    // Gaps of 1, 2, 3, 4, 10 seconds.
    const times = [0, 1000, 3000, 6000, 10000, 20000];
    expect(gapsOf(times)).toEqual({
      shortest: 1,
      lower: 2,
      median: 3,
      upper: 4,
    });
  });

  it('round to a tenth of a second and need two actions', () => {
    expect(gapsOf([0, 1234])).toEqual({
      shortest: 1.2,
      lower: 1.2,
      median: 1.2,
      upper: 1.2,
    });
    expect(gapsOf([0, 1250, 2550])).toEqual({
      shortest: 1.3,
      lower: 1.3,
      median: 1.3,
      upper: 1.3,
    });
    expect(gapsOf([5])).toBeNull();
    expect(gapsOf([])).toBeNull();
  });

  it('take the value at the rank of the share (nearest rank)', () => {
    // Eight gaps of 1 to 8 seconds: a quarter is two of them.
    const times = [0, 1, 3, 6, 10, 15, 21, 28, 36].map((s) => s * 1000);
    expect(gapsOf(times)).toEqual({
      shortest: 1,
      lower: 2,
      median: 4,
      upper: 6,
    });
  });
});

describe('the days of the hints', () => {
  const intervals = [{ start: D0 + 1000, end: D0 + 5000 }];

  it('count the actions, those outside active play time and the hits of the limit', () => {
    const days = botHints(
      [
        act(D0 + 1000),
        act(D0 + 5000),
        act(D0 + 9000),
        act(D0 + 9500, LIMIT_ACTION),
      ],
      intervals,
      D0,
      D0 + 10000,
    );
    expect(days).toEqual([
      {
        day: D0,
        actions: 3,
        outsidePlay: 1,
        limitHits: 1,
        gaps: { shortest: 4, lower: 4, median: 4, upper: 4 },
      },
    ]);
  });

  it('show only the days with actions or hits, newest first, each with its own gaps', () => {
    const days = botHints(
      [act(D0 + 10), act(D0 + 2 * DAY + 10), act(D0 + 2 * DAY + 3010)],
      [],
      D0,
      D0 + 3 * DAY,
    );
    expect(days.map((d) => d.day)).toEqual([D0 + 2 * DAY, D0]);
    expect(days[1]).toEqual({
      day: D0,
      actions: 1,
      outsidePlay: 1,
      limitHits: 0,
      gaps: null,
    });
    expect(days[0]!.gaps?.median).toBe(3);
    // A day with a hit of the limit and no action is shown too.
    expect(botHints([act(D0 + 5, LIMIT_ACTION)], [], D0, D0 + DAY)).toEqual([
      { day: D0, actions: 0, outsidePlay: 0, limitHits: 1, gaps: null },
    ]);
    expect(botHints([], intervals, D0, D0 + DAY)).toEqual([]);
  });

  it('read nothing from before the switch-on, nor after now', () => {
    const since = D0 + 5000;
    const days = botHints(
      [act(D0 + 1000), act(since), act(D0 + 6000), act(D0 + 9000)],
      [],
      since,
      D0 + 6000,
    );
    expect(days).toEqual([
      {
        day: D0,
        actions: 2,
        outsidePlay: 2,
        limitHits: 0,
        gaps: { shortest: 1, lower: 1, median: 1, upper: 1 },
      },
    ]);
  });

  it('never show a day older than 30 days, even when the data are there (#181, D4)', () => {
    const now = D0 + 40 * DAY;
    expect(HINT_DAYS).toBe(30);
    expect(hintsFrom(D0, now)).toBe(now - 30 * DAY);
    expect(hintsFrom(now - DAY, now)).toBe(now - DAY);
    // The play time is kept until the round is deleted: an old interval and
    // an old action must not show up.
    const days = botHints(
      [act(D0 + DAY), act(now - 30 * DAY - 1), act(now - 30 * DAY), act(now)],
      [{ start: D0, end: now }],
      D0,
      now,
    );
    expect(days.map((d) => d.day)).toEqual([
      now - (now % DAY),
      now - 30 * DAY - ((now - 30 * DAY) % DAY),
    ]);
    expect(days.reduce((n, d) => n + d.actions, 0)).toBe(2);
    expect(days.every((d) => d.outsidePlay === 0)).toBe(true);
  });
});
