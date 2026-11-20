// The panels of the page „Admin“ that fill themselves (the diagnostics, the
// errors and the list of the invitations) render as before #118, after
// bundle 7 („no visible change“ of the issue; each migration step changes no
// behaviour, owner, 2026-11-13). The old HTML is frozen in
// src/test/admin-panels-frozen.ts, the code of the DOM modules these panels
// were. On generated data (fixed fast-check seed 118) both render the same
// markup, up to what a browser does not show (normalize() of markup.ts), and
// the same text in every line, cell and button (textContents()); hand-built
// cases reach the rare marks. Svelte writes a valueless attribute as an empty
// one (`data-errors-list=""`), which a browser reads the same.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type {
  ErrorRow,
  EventRow,
  Invitation,
  Order,
  PlayerDetail,
  PlayerStats,
} from '../client/logic/admin-panels.ts';
import type { Players } from '../client/logic/types.ts';
import {
  diagnosticsView,
  errorsView,
  invitationsView,
  type Shown,
} from './admin-panels-view.ts';
import {
  diagnosticsPanel,
  errorsPanel,
  invitationList,
} from './admin-panels-frozen.ts';
import { normalize, textContents } from './markup.ts';

const settled = (html: string): string =>
  normalize(html).replaceAll(' data-errors-list=""', ' data-errors-list');
/** The text of every line, cell and button; the indentation of the old template inside a block is no text a person sees. */
const texts = (html: string): string[] =>
  textContents(html).map((t) =>
    /^(div|form|section):/.test(t) ? t.replace(/: +/, ': ').trimEnd() : t,
  );

// Characters of markup in every text.
const text = fc.constantFrom(
  'Sturm',
  'a<b>&"c\'',
  'x y',
  '',
  'Ödland ‹1›',
  '0',
);
const word = fc.constantFrom('p1_2_3', 'IY6nvG1yQ1E3', '<i>"x\'&', 'f1');
const time = fc.integer({ min: 1e12, max: 1.9e12 });
const maybe = <T>(a: fc.Arbitrary<T>): fc.Arbitrary<T | null> =>
  fc.option(a, { nil: null });

const players: Players = {
  u1: { name: 'Sturm' },
  u2: { name: 'a<b>&"c\'' },
} as unknown as Players;
const actor = fc.constantFrom<string | null>('u1', 'u2', 'u9', null);

const detail = fc
  .record(
    {
      planet: word,
      fleet: word,
      winner: fc.constantFrom('att', 'def'),
      source: text,
    },
    { requiredKeys: [] },
  )
  .map((d) => JSON.stringify(d));

const eventRow = fc.record({
  id: fc.nat(1e6),
  time,
  actor,
  actorName: maybe(text),
  category: text,
  action: fc.constantFrom('battle', 'login', 'build', 'a<b>'),
  outcome: text,
  target: actor,
  requestId: maybe(text),
  detail,
}) satisfies fc.Arbitrary<EventRow>;

const pageOf = <T>(rows: fc.Arbitrary<T[]>, key: string) =>
  fc
    .tuple(
      rows,
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 1, max: 4 }),
      fc.nat(500),
      fc.constantFrom(10, 25, 50, 100),
      fc.nat(1e6),
    )
    .map(([list, page, extra, count, limit, before]) => ({
      [key]: list,
      page,
      pages: Math.max(page, extra),
      count,
      limit,
      before,
    }));

const events = pageOf(fc.array(eventRow, { maxLength: 4 }), 'events');

const person = fc.record({
  id: fc.constantFrom('u1', 'u2'),
  name: text,
  admin: fc.constantFrom(0, 1),
  lastSeen: maybe(time),
  activeMs: fc.nat(1e8),
  actions: fc.nat(1e5),
  failedLogins: fc.nat(9),
  recentActions: fc.nat(60),
}) satisfies fc.Arbitrary<PlayerStats>;

const planet = fc.record({
  id: word,
  name: text,
  g: fc.nat(9),
  s: fc.nat(99),
  p: fc.nat(15),
  moon: fc.boolean(),
});

const playerDetail = fc.record({
  days: fc.array(
    fc.record({ day: time, activeMs: fc.nat(1e8), actions: fc.nat(1e5) }),
    { maxLength: 3 },
  ),
  suspension: maybe(fc.record({ reason: text, until: maybe(time) })),
  planets: fc.array(planet, { maxLength: 3 }),
}) satisfies fc.Arbitrary<PlayerDetail>;

const order = fc.record({
  kind: text,
  id: word,
  player: actor.map((a) => a ?? 'u1'),
  item: text,
  due: time,
  processed: maybe(time),
}) satisfies fc.Arbitrary<Order>;

const shown: fc.Arbitrary<Shown> = fc.record(
  {
    tab: fc.constantFrom('events', 'players', 'orders'),
    events,
    stats: fc.array(person, { maxLength: 3 }),
    record: fc.record({ person, detail: playerDetail }),
    orders: fc.record({
      orders: fc.array(order, { maxLength: 3 }),
      now: fc.constantFrom(0, 1.5e12, 2e12),
    }),
    notice: text,
  },
  { requiredKeys: ['tab'] },
) as unknown as fc.Arbitrary<Shown>;

describe('the diagnostics against the HTML before #118, after bundle 7', () => {
  it('renders every tab as before', () => {
    fc.assert(
      fc.property(shown, (x) => {
        expect(settled(diagnosticsView(players, x))).toBe(
          normalize(diagnosticsPanel(players, x)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('keeps the text of every line, cell and button as before', () => {
    fc.assert(
      fc.property(shown, (x) => {
        expect(texts(diagnosticsView(players, x))).toEqual(
          texts(diagnosticsPanel(players, x)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  const row = (over: Partial<EventRow>): EventRow => ({
    id: 7,
    time: 1.7e12,
    actor: 'u1',
    actorName: 'Sturm',
    category: 'system',
    action: 'battle',
    outcome: 'ok',
    target: 'u2',
    requestId: null,
    detail: '{}',
    ...over,
  });
  const stats = (over: Partial<PlayerStats>): PlayerStats => ({
    id: 'u1',
    name: 'Sturm',
    admin: 0,
    lastSeen: null,
    activeMs: 0,
    actions: 0,
    failedLogins: 0,
    recentActions: 0,
    ...over,
  });
  const record = (admin: number, detail: Partial<PlayerDetail>) => ({
    person: stats({ admin }),
    detail: { days: [], suspension: null, planets: [], ...detail },
  });

  const HAND_BUILT: [string, Shown][] = [
    ['nothing loaded yet', { tab: 'events' }],
    [
      'an event log without a row',
      {
        tab: 'events',
        events: {
          events: [],
          page: 1,
          pages: 1,
          count: 0,
          limit: 10,
          before: 0,
        },
      },
    ],
    [
      'a later page of the event log',
      {
        tab: 'events',
        events: {
          events: [
            row({ detail: '{"planet":"p","fleet":"f"}', requestId: 'r' }),
          ],
          page: 2,
          pages: 3,
          count: 25,
          limit: 10,
          before: 4,
        },
      },
    ],
    [
      'the last page',
      {
        tab: 'events',
        events: {
          events: [row({ actor: 'u9', actorName: null, action: 'login' })],
          page: 3,
          pages: 3,
          count: 21,
          limit: 10,
          before: 4,
        },
      },
    ],
    ['a refusal of the server', { tab: 'players', notice: 'Kein <Zugriff>' }],
    [
      'the failed logins and many actions of a player',
      {
        tab: 'players',
        stats: [
          stats({ failedLogins: 5, recentActions: 30, lastSeen: 1.7e12 }),
          stats({ id: 'u2', failedLogins: 4, recentActions: 29 }),
          stats({ id: 'u3', failedLogins: 5 }),
          stats({ id: 'u4', recentActions: 30 }),
        ],
      },
    ],
    [
      'the record of a player without a moon and with one, banned until a day',
      {
        tab: 'players',
        stats: [stats({})],
        record: record(0, {
          suspension: { reason: 'Spam <b>', until: 1.8e12 },
          planets: [
            { id: 'p1', name: 'Heim', g: 1, s: 2, p: 3, moon: false },
            { id: 'p2', name: 'Kolonie', g: 1, s: 5, p: 9, moon: true },
          ],
          days: [{ day: 1.7e12, activeMs: 90000, actions: 12 }],
        }),
      },
    ],
    [
      'the record of an admin, banned without an end',
      {
        tab: 'players',
        record: record(1, { suspension: { reason: 'x', until: null } }),
      },
    ],
    [
      'orders that are due and that run',
      {
        tab: 'orders',
        orders: {
          now: 1.7e12,
          orders: [
            {
              kind: 'build',
              id: 'p1',
              player: 'u1',
              item: 'metal',
              due: 1.7e12,
              processed: null,
            },
            {
              kind: 'fleet',
              id: 'f<1>',
              player: 'u9',
              item: 'x',
              due: 1.7e12 + 1,
              processed: 1.6e12,
            },
          ],
        },
      },
    ],
    ['no orders', { tab: 'orders', orders: { orders: [], now: 1 } }],
  ];

  it('renders the hand-built cases as before', () => {
    for (const [name, x] of HAND_BUILT) {
      expect(settled(diagnosticsView(players, x)), name).toBe(
        normalize(diagnosticsPanel(players, x)),
      );
      expect(texts(diagnosticsView(players, x)), name).toEqual(
        texts(diagnosticsPanel(players, x)),
      );
    }
  });

  it('keeps the marks the e2e tests, the handlers and style.css read', () => {
    const html = diagnosticsView(players, HAND_BUILT[6]![1]);
    for (const mark of [
      'id="diagnostics-filter"',
      'id="audit-player"',
      'id="audit-outcome"',
      'name="limit"',
      'data-admin="stats"',
      'data-admin="player"',
      'data-admin="orders"',
      'data-admin="events"',
      'data-diagnostics="player"',
      'data-diagnostics="playerEvents"',
      'class="moon-form flex"',
      'data-planet="p1"',
      'id="moderation-form"',
      'class="admin-table"',
      'class="mini"',
    ])
      expect(html, mark).toContain(mark);
  });
});

describe('the errors against the HTML before #118, after bundle 7', () => {
  const now = 1.7e12;
  const error = fc.record({
    id: fc.nat(1e6),
    kind: fc.constantFrom('server', 'client', 'report'),
    time,
    first: time,
    playerName: maybe(text),
    requestId: maybe(text).map((x) => x ?? ''),
    action: text,
    page: text,
    version: text,
    browser: text,
    message: text,
    detail: text,
    count: fc.constantFrom(1, 2, 1500),
    report: text,
  }) satisfies fc.Arbitrary<ErrorRow>;
  const loaded = fc.record(
    {
      data: pageOf(fc.array(error, { maxLength: 4 }), 'errors'),
      notice: text,
    },
    { requiredKeys: [] },
  );

  it('renders the panel as before', () => {
    fc.assert(
      fc.property(loaded, ({ data, notice }) => {
        expect(settled(errorsView(now, data as never, notice))).toBe(
          normalize(errorsPanel(now, data as never, notice)),
        );
        expect(texts(errorsView(now, data as never, notice))).toEqual(
          texts(errorsPanel(now, data as never, notice)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the cases without data, without a row and with the bare details', () => {
    const empty = {
      errors: [],
      page: 1,
      pages: 1,
      count: 0,
      limit: 10,
      before: 0,
    };
    const bare = {
      id: 3,
      kind: 'server' as const,
      time: 1.7e12,
      first: 1.7e12,
      playerName: null,
      requestId: null,
      action: '',
      page: '',
      version: '',
      browser: '',
      message: '',
      detail: '',
      count: 1,
      report: '',
    };
    for (const data of [
      undefined,
      empty,
      { ...empty, errors: [bare], count: 1 },
      {
        ...empty,
        errors: [{ ...bare, report: 'Text', message: 'Meldung', count: 3 }],
        count: 1,
      },
    ])
      expect(settled(errorsView(now, data as never))).toBe(
        normalize(errorsPanel(now, data as never)),
      );
  });
});

describe('the list of the invitations against the HTML before #118, after bundle 7', () => {
  const invitation = fc.record({
    id: word,
    email: text,
    created: time,
    expires: time,
  }) satisfies fc.Arbitrary<Invitation>;

  it('renders the list as before', () => {
    fc.assert(
      fc.property(fc.array(invitation, { maxLength: 4 }), (list) => {
        const old = `<div id="admin-invitations">${invitationList(list)}</div>`;
        expect(normalize(invitationsView({ list }))).toBe(normalize(old));
        expect(texts(invitationsView({ list }))).toEqual(texts(old));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('is empty before the list is read and shows a refusal as text', () => {
    expect(normalize(invitationsView(null))).toBe(
      '<div id="admin-invitations"></div>',
    );
    expect(normalize(invitationsView({ error: 'Kein <Zugriff>' }))).toBe(
      '<div id="admin-invitations">Kein &lt;Zugriff></div>',
    );
  });
});
