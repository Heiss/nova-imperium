// The round archive renders as before #118, bundle 7 („no visible change“ of
// the issue; each migration step changes no behaviour, owner, 2026-11-13).
// The old HTML is frozen in src/test/archive-frozen.ts (archiveHTML() and
// adminArchiveHTML() of logic/round-archive.ts with the list, the report and
// the history). On generated archives (fixed fast-check seed 118) the
// component RoundArchive renders the same markup, up to what a browser does
// not show (normalize() of markup.ts), and the same text in every line, cell
// and button (textContents(), which sees a space that normalize() cannot);
// hand-built cases reach the rare marks (a provisional report, a report with
// play time, a refusal, a round without participants, …).
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  HistoryEntry,
  ReportRow,
  RoundEntry,
  RoundReport,
} from '../core/round-report.ts';
import { ROUND_SETTINGS } from '../core/round.ts';
import {
  type ArchiveState,
  forgetArchive,
} from '../client/logic/round-archive.ts';
import { adminArchiveHTML, archiveHTML } from './archive-frozen.ts';
import { normalize, textContents } from './markup.ts';
import { archiveView } from './round-archive-view.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 12);

/** What a name may hold that is not plain text. */
const NAMES = ['Lea', 'Vex <b>', 'Cleo & Co', 'D"ora', "Emil's", 'a > b'];
const TAGS = ['AB', '<i>', 'X&Y'];

/**
 * The four categories of #78: the archives written before #422 keep them and
 * are shown as before (owner, 2026-11-26, 171b), so the old HTML is the
 * reference for them.
 */
const LEGACY_CATEGORIES = [
  'total',
  'buildings',
  'research',
  'fleet',
  'defense',
] as const;

const valuation = fc.record({
  total: fc.nat(99_999),
  buildings: fc.nat(9999),
  research: fc.nat(9999),
  fleet: fc.nat(9999),
  defense: fc.nat(9999),
});

const economy = fc.record({
  m: fc.nat(99_999),
  c: fc.nat(99_999),
  d: fc.nat(99_999),
});

const standing = fc.record({
  rank: fc.integer({ min: 1, max: 9 }),
  of: fc.integer({ min: 1, max: 9 }),
  points: fc.nat(99_999),
});

const guild = fc.option(
  fc.record({
    tag: fc.constantFrom(...TAGS),
    name: fc.constantFrom(...NAMES),
  }),
  { nil: null },
);

const row = (seat: number): fc.Arbitrary<ReportRow> =>
  fc.record({
    seat: fc.constant(seat),
    name: fc.constantFrom(...NAMES),
    you: fc.boolean(),
    valuation,
    economy,
    planets: fc.nat(9),
    moons: fc.nat(9),
    guild,
  }) as fc.Arbitrary<ReportRow>;

const rules = fc.constantFrom<Record<string, unknown>>(
  {},
  { guilds: false },
  { speed: 9, guilds: true },
  ...ROUND_SETTINGS.slice(0, 3).map((s) => ({ [s.name]: s.def })),
  ...ROUND_SETTINGS.slice(0, 3).map((s) => ({
    [s.name]: s.kind === 'switch' ? !s.def : 77,
  })),
);

const report = fc
  .record({
    round: fc.record({
      number: fc.integer({ min: 1, max: 12 }),
      provisional: fc.boolean(),
      asOf: fc.integer({ min: 0, max: 40 }).map((d) => START + d * DAY),
      started: fc.constant(START),
      closed: fc.constant(START + 30 * DAY),
      days: fc.integer({ min: 0, max: 40 }),
      coverage: fc.constantFrom('complete' as const, 'partial' as const),
      rules,
    }),
    you: fc.option(standing, { nil: null }),
    rows: fc
      .integer({ min: 0, max: 4 })
      .chain((n) =>
        fc.tuple(...Array.from({ length: n }, (_, i) => row(i + 1))),
      ),
    guilds: fc.array(
      fc.record({
        tag: fc.constantFrom(...TAGS),
        name: fc.constantFrom(...NAMES),
        members: fc.integer({ min: 1, max: 9 }),
        points: fc.nat(99_999),
      }),
      { maxLength: 3 },
    ),
    playtime: fc.option(
      fc.record(
        {
          1: fc.nat(40_000_000),
          2: fc.nat(40_000_000),
          3: fc.nat(40_000_000),
        },
        { requiredKeys: [] },
      ),
      { nil: null },
    ),
  })
  .map(
    (r) =>
      ({
        ...r,
        // A guild appears once, as the server sends it.
        guilds: r.guilds.filter(
          (g, i) => r.guilds.findIndex((x) => x.tag === g.tag) === i,
        ),
      }) as unknown as RoundReport,
  );

const entry = fc.record({
  status: fc.constantFrom('active' as const, 'closed' as const),
  closed: fc.option(fc.constant(START + 20 * DAY), { nil: null }),
  coverage: fc.constantFrom('complete' as const, 'partial' as const),
  locked: fc.boolean(),
  participants: fc.option(fc.nat(9), { nil: null }),
  you: fc.option(standing, { nil: null }),
});

const entries = fc.array(entry, { maxLength: 4 }).map((list) =>
  list.map((e, i): RoundEntry => ({
    ...e,
    number: i + 1,
    started: START + i * DAY,
  })),
);

const history = fc
  .array(
    fc.record({
      days: fc.nat(40),
      coverage: fc.constantFrom('complete' as const, 'partial' as const),
      rules,
      participants: fc.nat(9),
      winner: fc.option(
        fc.record({ name: fc.constantFrom(...NAMES), points: fc.nat(99_999) }),
        { nil: null },
      ),
      you: fc.option(
        fc.record({
          rank: fc.integer({ min: 1, max: 9 }),
          of: fc.integer({ min: 1, max: 9 }),
          points: fc.nat(99_999),
          valuation,
          economy,
          planets: fc.nat(9),
          moons: fc.nat(9),
        }),
        { nil: null },
      ),
    }),
    { maxLength: 3 },
  )
  .map((list) =>
    list.map(
      (h, i): HistoryEntry =>
        ({
          ...h,
          number: i + 1,
          started: START,
          closed: START + DAY,
        }) as HistoryEntry,
    ),
  );

const state = fc
  .record({
    entries: fc.option(entries, { nil: null }),
    history: fc.option(history, { nil: null }),
    report: fc.option(report, { nil: null }),
    category: fc.constantFrom(...LEGACY_CATEGORIES),
    error: fc.constantFrom(
      null,
      null,
      null,
      'Das Archiv <ist> nicht da & "weg".',
    ),
    admin: fc.boolean(),
  })
  .map(({ admin, ...a }) => ({
    admin,
    a: { user: 'u_me', round: 4, loading: false, ...a } as ArchiveState,
  }));

const old = (a: ArchiveState, admin: boolean): string =>
  admin ? adminArchiveHTML(a) : archiveHTML(a);

afterEach(() => forgetArchive());

const report1 = (over: Partial<RoundReport['round']> = {}): RoundReport => ({
  round: {
    number: 3,
    provisional: false,
    asOf: Date.UTC(2026, 10, 20, 12),
    started: START,
    closed: Date.UTC(2026, 10, 20, 12),
    days: 19,
    coverage: 'complete',
    rules: {},
    ...over,
  },
  you: { rank: 2, of: 3, points: 8400 },
  rows: [
    {
      seat: 1,
      name: 'Lea',
      you: false,
      valuation: {
        total: 9100,
        buildings: 1,
        research: 2,
        fleet: 3,
        defense: 4,
      },
      economy: { m: 1000, c: 500, d: 250 },
      planets: 2,
      moons: 1,
      guild: { tag: 'AB', name: 'Alpha' },
    },
    {
      seat: 2,
      name: 'Vex',
      you: true,
      valuation: {
        total: 8400,
        buildings: 5,
        research: 6,
        fleet: 7,
        defense: 8,
      },
      economy: { m: 1, c: 2, d: 3 },
      planets: 1,
      moons: 0,
      guild: null,
    },
  ],
  guilds: [{ tag: 'AB', name: 'Alpha', members: 1, points: 9100 }],
  playtime: null,
});

const entry1 = (over: Partial<RoundEntry>): RoundEntry => ({
  number: 1,
  status: 'closed',
  started: START,
  closed: START + 30 * DAY,
  coverage: 'complete',
  locked: false,
  participants: 3,
  you: { rank: 2, of: 3, points: 8400 },
  ...over,
});

const history1: HistoryEntry = {
  number: 1,
  started: START,
  closed: START + DAY,
  days: 12,
  coverage: 'partial',
  rules: { guilds: false },
  participants: 5,
  winner: { name: 'Lea', points: 9100 },
  you: {
    rank: 2,
    of: 5,
    points: 8400,
    valuation: { total: 8400, buildings: 1, research: 2, fleet: 3, defense: 4 },
    economy: { m: 1, c: 2, d: 3 },
    planets: 4,
    moons: 1,
  },
};

const at = (over: Partial<ArchiveState>): ArchiveState => ({
  user: 'u_me',
  round: 4,
  entries: null,
  history: null,
  report: null,
  participant: null,
  rewind: null,
  category: 'total',
  loading: false,
  error: null,
  ...over,
});

/** The cases the sample reaches rarely, each as the player and as the admin. */
const HAND_BUILT: [string, ArchiveState][] = [
  ['loading', at({})],
  ['a refusal', at({ entries: [], error: 'Nicht <da>' })],
  ['no round', at({ entries: [], history: [] })],
  [
    'every kind of round',
    at({
      entries: [
        entry1({ number: 1 }),
        entry1({ number: 2, you: null, participants: 7 }),
        entry1({ number: 3, you: null, participants: null }),
        entry1({
          number: 4,
          status: 'active',
          closed: null,
          locked: true,
          you: null,
        }),
        entry1({ number: 5, status: 'active', closed: null, you: null }),
      ],
      history: [history1, { ...history1, number: 2, you: null, winner: null }],
    }),
  ],
  ['a report', at({ entries: [entry1({})], report: report1() })],
  [
    'a provisional report in a category',
    at({
      report: report1({ provisional: true, closed: null }),
      category: 'fleet',
    }),
  ],
  [
    'a report with play time and a partly covered round',
    at({
      report: {
        ...report1({ coverage: 'partial', rules: { guilds: false } }),
        playtime: { 1: 3_900_000, 2: 0 },
      },
      category: 'research',
    }),
  ],
  [
    'a report without participants and without a guild',
    at({ report: { ...report1(), rows: [], guilds: [], you: null } }),
  ],
];

describe('the round archive against the HTML before #118, bundle 7', () => {
  it('renders the box as before', () => {
    fc.assert(
      fc.property(state, ({ a, admin }) => {
        expect(normalize(archiveView(a, admin))).toBe(normalize(old(a, admin)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('keeps the text of every line, cell and button as before', () => {
    fc.assert(
      fc.property(state, ({ a, admin }) => {
        expect(textContents(archiveView(a, admin))).toEqual(
          textContents(old(a, admin)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before, for the player and for the admin', () => {
    for (const [name, a] of HAND_BUILT)
      for (const admin of [false, true]) {
        const label = `${name} (${admin ? 'admin' : 'player'})`;
        expect(normalize(archiveView(a, admin)), label).toBe(
          normalize(old(a, admin)),
        );
        expect(textContents(archiveView(a, admin)), label).toEqual(
          textContents(old(a, admin)),
        );
      }
  });

  it('keeps the marks features/round-archive.ts and style.css read', () => {
    const html = archiveView(HAND_BUILT[3]![1], true);
    for (const mark of [
      'data-act="roundClose"',
      'data-act="roundOpen" data-round="1"',
      'data-act="roundDelete" data-round="1"',
      'class="scores"',
    ])
      expect(html, mark).toContain(mark);
    const open = archiveView(HAND_BUILT[4]![1]);
    for (const mark of [
      'data-act="roundBack"',
      'data-act="roundCat" data-cat="total"',
      'id="round-report-h"',
      'class="kv"',
      'class="me"',
    ])
      expect(open, mark).toContain(mark);
  });

  it('shows „Vorschau aktualisieren“ on a provisional report and the drilldown buttons to the admin only (#235, view H)', () => {
    const provisional = HAND_BUILT.find(
      ([name]) => name === 'a provisional report in a category',
    )![1];
    const admin = archiveView(provisional, true);
    expect(admin).toContain('data-act="roundRefresh" data-round="3"');
    expect(admin).toContain('>Vorschau aktualisieren<');
    expect(admin).toContain(
      'data-act="roundPerson" data-round="3" data-seat="',
    );
    // A player's page offers neither, and a finished report no refresh.
    const player = archiveView(provisional);
    expect(player).not.toContain('roundPerson');
    expect(archiveView(HAND_BUILT[4]![1], true)).not.toContain('roundRefresh');
  });

  it('draws the drilldown of a participant with the way back', () => {
    const open = HAND_BUILT.find(
      ([name]) => name === 'a provisional report in a category',
    )![1];
    const html = archiveView(
      {
        ...open,
        participant: {
          round: { number: 1, provisional: true, asOf: START },
          seat: 1,
          name: 'Vex <b>',
          guild: null,
          valuation: {
            total: 5,
            buildings: 1,
            research: 1,
            fleet: 2,
            defense: 1,
          },
          economy: { m: 1, c: 2, d: 3 },
          research: {},
          places: [
            { kind: 'planet', g: 1, s: 1, p: 1, b: {}, ships: {}, def: {} },
          ],
          flying: {},
          vacation: true,
          playtime: null,
        },
      },
      true,
    );
    expect(html).toContain('data-act="roundPersonBack"');
    expect(html).toContain('id="round-participant-h"');
    expect(html).toContain('Vex &lt;b>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('roundClose');
  });
});
