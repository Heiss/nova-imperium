// The cards of the Runden-Rewind that read the events of the round (#235, owner
// 2026-11-21): their place among the cards of the slots, their facts, and the
// honest shorter form where the events do not hold what a card needs.
import { describe, expect, it } from 'vitest';
import { UNIT } from './catalog.ts';
import { EVENT_KIND } from './round-events.ts';
import {
  DELETED_PLAYER,
  type ReportRow,
  type RoundReport,
} from './round-report.ts';
import { rewindOf } from './round-rewind.ts';
import type { RewindEvent } from './round-rewind-facts.ts';

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
  valuation: { total, buildings: total, research: 0, fleet: 0, defense: 0 },
  economy: { m: 1, c: 1, d: 1 },
  planets: 1,
  moons: 0,
  guild: null,
});

const THREE = [
  row(1, 'Lea', 9100),
  row(2, 'Vex', 8400, true),
  row(3, 'Kai', 100),
];

const report = (
  rows: ReportRow[] = THREE,
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
});

const ev = (
  at: number,
  kind: string,
  seat: number | null,
  payload: object,
  version = 2,
): RewindEvent => ({
  at,
  kind,
  seat,
  version,
  payload: payload as Record<string, unknown>,
});

const prod = (over: object) => ({
  place: 'p1_1_1',
  owner: 2,
  from: 0,
  to: 1,
  m: 0,
  c: 0,
  d: 0,
  f: 1,
  ...over,
});

const lf = UNIT.lf!.cost;
const worth = lf[0]! + lf[1]! + lf[2]!;

/** Vex (seat 2) builds 10 light fighters, loses 6 to Lea on day 17, builds 6 more on day 22; the Endzeit is on day 28. */
const story = (): RewindEvent[] => [
  ev(START, EVENT_KIND.joined, 2, { entry: 'home', places: [], research: {} }),
  ev(START + DAY, EVENT_KIND.action, 2, {
    cause: 'build',
    ok: true,
    prod: [
      prod({
        m: 1_000_000,
        c: 500_000,
        d: 100_000,
        built: { key: 'metal', lvl: 1, end: 1, cost: [100, 100, 0] },
        unitsCost: { ships: lf.map((x) => x * 10) },
      }),
    ],
  }),
  ev(START + 16 * DAY + 5, EVENT_KIND.arrival, 1, {
    cause: 'arrival',
    target: 2,
    battle: {
      attBefore: { hf: 3 },
      attAfter: { hf: 3 },
      defBefore: { lf: 10 },
      defAfter: { lf: 4 },
    },
  }),
  ev(START + 21 * DAY, EVENT_KIND.action, 2, {
    cause: 'build',
    ok: true,
    prod: [prod({ unitsCost: { ships: lf.map((x) => x * 6) } })],
  }),
  ev(START + 27 * DAY + 100, 'admin.endzeit', 1, { minutes: 5 }, 1),
  ev(START + 27 * DAY + 400, EVENT_KIND.arrival, 2, {
    cause: 'arrival',
    gift: true,
    ships: { lf: 42 },
    cargo: { m: 1e6, c: 1e6, d: 1e6 },
  }),
];

const slots = (events: RewindEvent[], seat = 2, rows = THREE) =>
  rewindOf(report(rows), seat, events).cards.map((c) => c.slot);

describe('a round with complete events of version 2', () => {
  it('has all eight cards in the order of the slots', () => {
    const r = rewindOf(report(), 2, story());
    expect(r.cards.map((c) => [c.slot, c.kind])).toEqual([
      [1, 'identity'],
      [2, 'economy'],
      [3, 'focus'],
      [4, 'loss'],
      [5, 'return'],
      [6, 'playtime'],
      [7, 'endzeit'],
      [8, 'rank'],
    ]);
  });

  it('holds the facts of the events on the cards 2, 3, 4, 5 and 7', () => {
    const cards = rewindOf(report(), 2, story()).cards;
    expect(cards[1]).toEqual({
      kind: 'economy',
      slot: 2,
      m: 1_000_000,
      c: 500_000,
      d: 100_000,
      total: 1_600_000,
    });
    expect(cards[2]).toEqual({
      kind: 'focus',
      slot: 3,
      focus: 'fleet',
      percent: 100,
    });
    expect(cards[3]).toEqual({
      kind: 'loss',
      slot: 4,
      day: 17,
      points: Math.floor((worth * 6) / 1000),
      role: 'defender',
      opponent: 'Lea',
    });
    expect(cards[4]).toEqual({ kind: 'return', slot: 5, days: 5, lossDay: 17 });
    expect(cards[6]).toEqual({
      kind: 'endzeit',
      slot: 7,
      day: 28,
      gift: { ships: 42, cargo: { m: 1e6, c: 1e6, d: 1e6 } },
    });
  });

  it('names the opponent as the archive does, a deleted account as the pseudonym', () => {
    const rows = [row(1, DELETED_PLAYER, 9100), row(2, 'Vex', 8400, true)];
    expect(rewindOf(report(rows), 2, story()).cards[3]).toMatchObject({
      opponent: DELETED_PLAYER,
    });
    // An opponent without a row in the report stays unnamed.
    const alone = rewindOf(report([row(2, 'Vex', 8400, true)]), 2, story());
    expect(alone.cards.find((c) => c.kind === 'loss')).toMatchObject({
      opponent: null,
    });
  });

  it('leaves out only the cards whose facts are missing: no combat, no Endzeit, no way back', () => {
    const events = story();
    expect(slots(events.filter((e) => !e.payload.battle))).toEqual([
      1, 2, 3, 6, 7, 8,
    ]);
    expect(
      slots(
        events.filter((e) => e.kind !== 'admin.endzeit' && !e.payload.gift),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 8]);
    expect(slots(events.filter((e) => e.at !== START + 21 * DAY))).toEqual([
      1, 2, 3, 4, 6, 7, 8,
    ]);
  });

  it('keeps the day of a loss inside the round', () => {
    const late = story().map((e) =>
      e.payload.battle ? { ...e, at: START + 99 * DAY } : e,
    );
    const loss = rewindOf(report(), 2, late).cards.find(
      (c) => c.kind === 'loss',
    );
    expect(loss).toMatchObject({ day: 30 });
    const early = story().map((e) =>
      e.payload.battle ? { ...e, at: START - DAY } : e,
    );
    expect(
      rewindOf(report(), 2, early).cards.find((c) => c.kind === 'loss'),
    ).toMatchObject({ day: 1 });
  });
});

describe('a round that lacks version 2 events', () => {
  it('keeps the short form for no events and for events of another seat', () => {
    expect(slots([])).toEqual([1, 6, 8]);
    expect(slots(story(), 3)).toEqual([1, 6, 8]);
  });

  it('leaves out every card that needs version 2 for events of version 1, and keeps the battle card, which version 1 holds', () => {
    const old = story().map((e) =>
      e.kind === 'admin.endzeit' ? e : { ...e, version: 1 },
    );
    expect(slots(old)).toEqual([1, 4, 6, 8]);
  });

  it('is the same for a round that mixes both versions', () => {
    const mixed = story().map((e, i) => (i === 3 ? { ...e, version: 1 } : e));
    expect(slots(mixed)).toEqual([1, 4, 6, 8]);
  });

  it('has no card of the events for the running round', () => {
    const r = report(THREE, { provisional: true, closed: null });
    expect(rewindOf(r, 2, story())).toEqual({ round: 3, cards: [] });
  });
});
