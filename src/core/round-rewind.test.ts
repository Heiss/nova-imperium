// The facts of the thin Runden-Rewind (#235, view G): a card exists only when
// its facts exist, ranks and ties, a deleted account as the winner.
import { describe, expect, it } from 'vitest';
import {
  DELETED_PLAYER,
  type ReportRow,
  type RoundReport,
} from './round-report.ts';
import { rewindOf } from './round-rewind.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 12);

const row = (
  seat: number,
  name: string,
  total: number,
  you = false,
): ReportRow => ({
  seat,
  name,
  you,
  valuation: {
    total,
    buildings: total,
    research: 0,
    fleet: 0,
    defense: 0,
  },
  economy: { m: 1, c: 1, d: 1 },
  planets: 1,
  moons: 0,
  guild: null,
});

/** A finished round of 30 days; the seats are the arguments of the rows. */
const report = (
  rows: ReportRow[],
  over: Partial<RoundReport> = {},
  round: Partial<RoundReport['round']> = {},
): RoundReport => ({
  round: {
    number: 3,
    provisional: false,
    asOf: START + 30 * DAY,
    started: START,
    closed: START + 30 * DAY,
    days: 30,
    coverage: 'complete',
    rules: {},
    ...round,
  },
  you: null,
  rows,
  guilds: [],
  playtime: { 1: 3_600_000, 2: 45_600_000, 3: 0 },
  ...over,
});

const THREE = [
  row(1, 'Lea', 9100),
  row(2, 'Vex', 8400, true),
  row(3, 'Kai', 100),
];

describe('the cards of a finished round with everything archived', () => {
  it('has the cards 1, 6 and 8 in the order of the issue', () => {
    const r = rewindOf(report(THREE), 2);
    expect(r.round).toBe(3);
    expect(r.cards.map((c) => [c.slot, c.kind])).toEqual([
      [1, 'identity'],
      [6, 'playtime'],
      [8, 'rank'],
    ]);
  });

  it('holds the facts of the round on card 1', () => {
    expect(rewindOf(report(THREE), 2).cards[0]).toEqual({
      kind: 'identity',
      slot: 1,
      number: 3,
      started: START,
      closed: START + 30 * DAY,
      days: 30,
      participants: 3,
      coverage: 'complete',
    });
  });

  it('takes the cutoff of the round as its end, the time of the report only without one', () => {
    const later = START + 40 * DAY;
    const closed = report(THREE, {}, { asOf: later });
    expect(rewindOf(closed, 2).cards[0]).toMatchObject({
      closed: START + 30 * DAY,
    });
    const open = report(THREE, {}, { asOf: later, closed: null });
    expect(rewindOf(open, 2).cards[0]).toMatchObject({ closed: later });
  });

  it('holds the play time of the reader`s own seat on card 6, not another seat', () => {
    const cards = rewindOf(report(THREE), 2).cards;
    expect(cards[1]).toEqual({
      kind: 'playtime',
      slot: 6,
      ms: 45_600_000,
      partial: false,
    });
    expect(rewindOf(report(THREE), 1).cards[1]).toMatchObject({
      ms: 3_600_000,
    });
  });

  it('marks the play time of a partly covered round', () => {
    const r = report(THREE, {}, { coverage: 'partial' });
    expect(rewindOf(r, 2).cards[1]).toMatchObject({ partial: true });
    expect(rewindOf(r, 2).cards[0]).toMatchObject({ coverage: 'partial' });
  });

  it('keeps a measured zero: a zero is a fact, not an unknown value', () => {
    expect(rewindOf(report(THREE), 3).cards[1]).toMatchObject({ ms: 0 });
  });

  it('holds the final place, the points and the winner on card 8', () => {
    expect(rewindOf(report(THREE), 2).cards[2]).toEqual({
      kind: 'rank',
      slot: 8,
      number: 3,
      rank: 2,
      of: 3,
      points: 8400,
      tied: false,
      winner: { name: 'Lea', points: 9100, you: false },
    });
  });
});

describe('a Rewind of a thin history', () => {
  it('has cards 1 and 8 only for a round archived before the play time', () => {
    const r = rewindOf(report(THREE, { playtime: null }), 2);
    expect(r.cards.map((c) => c.slot)).toEqual([1, 8]);
  });

  it('leaves out card 6 for a seat the play time map does not know', () => {
    const r = rewindOf(report(THREE, { playtime: { 1: 5 } }), 2);
    expect(r.cards.map((c) => c.slot)).toEqual([1, 8]);
  });

  it('has no cards for the provisional report of the running round', () => {
    const r = report(
      THREE,
      { playtime: null },
      { provisional: true, closed: null },
    );
    expect(rewindOf(r, 2)).toEqual({ round: 3, cards: [] });
  });

  it('has no cards for a seat that is not among the participants', () => {
    expect(rewindOf(report(THREE), 9)).toEqual({ round: 3, cards: [] });
    expect(rewindOf(report([]), 1)).toEqual({ round: 3, cards: [] });
  });

  it('has three short cards for a single participant', () => {
    const r = rewindOf(report([row(1, 'Vex', 50, true)]), 1);
    expect(r.cards[0]).toMatchObject({ participants: 1 });
    expect(r.cards[2]).toMatchObject({
      rank: 1,
      of: 1,
      tied: false,
      winner: { name: 'Vex', you: true },
    });
  });
});

describe('the final place', () => {
  it('is 1 of n for the winner, who is named as such', () => {
    const r = rewindOf(report(THREE), 1).cards[2];
    expect(r).toMatchObject({ rank: 1, winner: { name: 'Lea', you: true } });
  });

  it('is the last place for the weakest', () => {
    expect(rewindOf(report(THREE), 3).cards[2]).toMatchObject({
      rank: 3,
      of: 3,
      points: 100,
    });
  });

  it('ranks the rows itself, so an unsorted report gives the same place', () => {
    const shuffled = [THREE[2]!, THREE[0]!, THREE[1]!];
    expect(rewindOf(report(shuffled), 2).cards[2]).toMatchObject({ rank: 2 });
  });

  it('marks equal points, and the order of the seats decides the place as in the report', () => {
    const tied = [
      row(1, 'Lea', 500),
      row(2, 'Vex', 500, true),
      row(3, 'Kai', 100),
    ];
    expect(rewindOf(report(tied), 1).cards[2]).toMatchObject({
      rank: 1,
      tied: true,
    });
    expect(rewindOf(report(tied), 2).cards[2]).toMatchObject({
      rank: 2,
      tied: true,
      winner: { name: 'Lea', you: false },
    });
    expect(rewindOf(report(tied), 3).cards[2]).toMatchObject({ tied: false });
  });

  it('is tied also when everybody ended with the same points', () => {
    const all = [row(1, 'A', 0), row(2, 'B', 0), row(3, 'C', 0)];
    expect(rewindOf(report(all), 3).cards[2]).toMatchObject({
      rank: 3,
      tied: true,
    });
  });

  it('names a deleted account as it stands in the archive', () => {
    const rows = [row(1, DELETED_PLAYER, 9100), row(2, 'Vex', 8400, true)];
    expect(rewindOf(report(rows), 2).cards[2]).toMatchObject({
      winner: { name: DELETED_PLAYER, points: 9100, you: false },
    });
  });
});
