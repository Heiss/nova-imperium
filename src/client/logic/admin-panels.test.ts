import { describe, expect, it } from 'vitest';
import {
  botCheckBlock,
  botDayLine,
  dateValue,
  dayQuery,
  dayTime,
  ERROR_PAGES,
  errorRange,
  errorsPage,
  EVENT_FIELDS,
  EVENT_PAGES,
  type EventRow,
  eventDetail,
  eventsPage,
  invitationsPage,
  reportsPage,
  nameOf,
  ordersPage,
  pagerPage,
  playerPage,
  statsPage,
} from './admin-panels.ts';
import { dt } from './format.ts';
import type { Players } from './types.ts';

const players = { u1: { name: 'Sturm' } } as unknown as Players;

const event = (over: Partial<EventRow> = {}): EventRow => ({
  id: 7,
  time: 1.7e12,
  actor: 'u1',
  actorName: 'Sturm',
  category: 'system',
  action: 'battle',
  outcome: 'ok',
  target: null,
  requestId: null,
  detail: '{}',
  ...over,
});

describe('the names of the players', () => {
  it('shows the name, the id of an unknown player and a dash for none', () => {
    expect(nameOf(players, 'u1')).toBe('Sturm');
    expect(nameOf(players, 'u9')).toBe('u9');
    expect(nameOf(players, null)).toBe('—');
  });
});

describe('the days of a filter', () => {
  it('reads a day as its first or last millisecond in local time, none as 0', () => {
    expect(dayTime('2026-11-20')).toBe(new Date(2026, 10, 20).getTime());
    expect(dayTime('2026-11-20', true)).toBe(
      new Date(2026, 10, 20, 23, 59, 59, 999).getTime(),
    );
    expect(dayTime('')).toBe(0);
    expect(dayTime(undefined, true)).toBe(0);
  });

  it('sends the fields of the filter with the days as times', () => {
    expect(
      dayQuery({ ...EVENT_FIELDS, action: 'build', since: '2026-11-20' }),
    ).toEqual({
      ...EVENT_FIELDS,
      action: 'build',
      since: new Date(2026, 10, 20).getTime(),
      until: 0,
    });
  });

  it('proposes the last 7 calendar days, today and the six before', () => {
    const now = new Date(2026, 10, 20, 12).getTime();
    expect(dateValue(now)).toBe('2026-11-20');
    expect(errorRange(now)).toEqual({
      since: '2026-11-14',
      until: '2026-11-20',
    });
    // Over the end of a month and of a year.
    expect(dateValue(new Date(2027, 0, 3).getTime(), 6)).toBe('2026-12-28');
  });
});

describe('the buttons of the pages of a list', () => {
  const data = { page: 1, pages: 3, count: 25, limit: 10 };

  it('disables the first and the previous page on the first page', () => {
    const p = pagerPage(data, EVENT_PAGES);
    expect(p.buttons.map((b) => [b.label, b.to, b.disabled])).toEqual([
      ['Erste Seite', 1, true],
      ['Vorherige Seite', 0, true],
      ['Nächste Seite', 2, false],
      ['Letzte Seite', 3, false],
    ]);
    expect(p.status).toBe('Seite 1 von 3 · 25 Ereignisse');
    expect(p.note).toBe('Die letzten 10 Ereignisse');
    expect(p.group).toBe('Protokollseiten');
    expect(p.attribute).toBe('diagnostics');
  });

  it('counts fewer entries than the limit on the first page, and calls later pages older', () => {
    expect(pagerPage({ ...data, count: 4 }, ERROR_PAGES).note).toBe(
      'Die letzten 4 Einträge',
    );
    const last = pagerPage({ ...data, page: 3 }, ERROR_PAGES);
    expect(last.buttons.map((b) => b.disabled)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(last.note).toBe('Ältere Einträge');
    expect(last.attribute).toBe('errors');
    expect(last.group).toBe('Fehlerseiten');
  });
});

describe('eventDetail (#151)', () => {
  it('offers a reference for the planet and the fleet of a battle, planet first', () => {
    expect(
      eventDetail(
        event({ detail: '{"fleet":"IY6nvG1yQ1E3","planet":"p1_35_6"}' }),
      ),
    ).toEqual({
      title: 'Kampfdetails',
      id: 7,
      request: null,
      raw: '{"fleet":"IY6nvG1yQ1E3","planet":"p1_35_6"}',
      references: ['p1_35_6', 'IY6nvG1yQ1E3'],
    });
  });

  it('offers only the references the event has', () => {
    expect(eventDetail(event({ detail: '{"fleet":"f1"}' })).references).toEqual(
      ['f1'],
    );
    expect(
      eventDetail(event({ detail: '{"planet":"p1_2_3"}' })).references,
    ).toEqual(['p1_2_3']);
    expect(
      eventDetail(event({ action: 'login', detail: '{"source":"operator"}' })),
    ).toMatchObject({ title: 'Ereignis', references: [] });
  });

  it('keeps the request id when the event has one', () => {
    expect(eventDetail(event({ requestId: 'r-1' })).request).toBe('r-1');
    expect(eventDetail(event({ requestId: '' })).request).toBeNull();
  });
});

describe('the event log', () => {
  it('shows a player button for a known actor and the name or a dash otherwise', () => {
    const page = eventsPage(
      {
        events: [
          event(),
          event({ actor: 'u1', actorName: null, target: 'u9' }),
          event({ actor: null, actorName: null }),
        ],
        page: 1,
        pages: 1,
        count: 3,
        limit: 10,
        before: 0,
      },
      players,
    );
    expect(page.table.headers).toEqual([
      'Zeit',
      'Akteur',
      'Kategorie / Aktion',
      'Ergebnis',
      'Ziel',
      'Details',
    ]);
    expect(page.table.rows.map((r) => r.slice(0, 5))).toEqual([
      [
        dt(1.7e12),
        { kind: 'player', id: 'u1', name: 'Sturm' },
        'system / battle',
        'ok',
        '—',
      ],
      [dt(1.7e12), 'Sturm', 'system / battle', 'ok', 'u9'],
      [dt(1.7e12), '—', 'system / battle', 'ok', '—'],
    ]);
  });
});

describe('the player records and the orders', () => {
  const stats = (over = {}) => ({
    id: 'u1',
    name: 'Sturm',
    admin: 0,
    lastSeen: null,
    activeMs: 150000,
    actions: 1234,
    failedLogins: 0,
    recentActions: 0,
    ...over,
  });

  it('counts the minutes rounded and the actions with separators', () => {
    const [row] = statsPage([stats()]).rows;
    expect(row).toEqual([
      { kind: 'player', id: 'u1', name: 'Sturm' },
      '—',
      '3',
      '1.234',
      '—',
    ]);
  });

  it('notes 5 failed logins and 30 actions in a minute, not 4 and 29', () => {
    const hints = (over: object) => statsPage([stats(over)]).rows[0]![4];
    expect(hints({ failedLogins: 5 })).toBe('5 abgelehnte Logins in 1 Std.');
    expect(hints({ recentActions: 30 })).toBe('30 Aktionen in 1 Min.');
    expect(hints({ failedLogins: 5, recentActions: 30 })).toBe(
      '5 abgelehnte Logins in 1 Std. · 30 Aktionen in 1 Min.',
    );
    expect(hints({ failedLogins: 4, recentActions: 29 })).toBe('—');
  });

  it('calls an order due when its time has come, and names its player', () => {
    const order = (due: number, processed: number | null) => ({
      kind: 'build',
      id: 'p1',
      player: 'u1',
      item: 'metal',
      due,
      processed,
    });
    const page = ordersPage([order(10, null), order(11, 5)], 10, players);
    expect(page.rows[0]).toEqual([
      'build / metal',
      'Sturm',
      { kind: 'reference', id: 'p1' },
      dt(10),
      'Fällig',
      '—',
    ]);
    expect(page.rows[1]!.slice(4)).toEqual(['Läuft', dt(5)]);
  });

  const detail = (over = {}) => ({
    days: [],
    suspension: null,
    planets: [],
    ...over,
  });

  it('shows the state of the access, with the end of a ban or without', () => {
    const status = (suspension: object | null) =>
      playerPage(stats(), detail({ suspension }), 20).status;
    expect(status(null)).toBe('Spielerzugang aktiv');
    expect(status({ reason: 'Spam', until: null })).toBe(
      'Gesperrt bis zur Freigabe · Spam',
    );
    expect(status({ reason: 'Spam', until: 1.7e12 })).toBe(
      `Gesperrt bis ${dt(1.7e12)} · Spam`,
    );
  });

  it('offers the moderation for a player who is no admin only', () => {
    expect(playerPage(stats(), detail(), 20).moderation).toBe(true);
    expect(playerPage(stats({ admin: 1 }), detail(), 20).moderation).toBe(
      false,
    );
  });

  it('lists the days in UTC and the planets, a moon form for a planet without one (#53)', () => {
    const page = playerPage(
      stats(),
      detail({
        days: [{ day: Date.UTC(2026, 10, 20), activeMs: 60000, actions: 5 }],
        planets: [
          { id: 'p1', name: 'Heim', g: 1, s: 2, p: 3, moon: false },
          { id: 'p2', name: 'Kolonie', g: 4, s: 5, p: 6, moon: true },
        ],
      }),
      20,
    );
    expect(page.heading).toBe('Spielerakte · Sturm');
    expect(page.days.rows).toEqual([['2026-11-20', '1', '5']]);
    expect(page.planets.rows).toEqual([
      ['Heim', '[1:2:3]', { kind: 'moon', planet: 'p1', min: 1, max: 20 }],
      ['Kolonie', '[4:5:6]', 'vorhanden'],
    ]);
  });

  it('offers a moon of 1 % up to the cap of the round (#433, 210a)', () => {
    const planets = [{ id: 'p1', name: 'Heim', g: 1, s: 2, p: 3, moon: false }];
    for (const cap of [1, 37, 100])
      expect(
        playerPage(stats(), detail({ planets }), cap).planets.rows,
      ).toEqual([
        ['Heim', '[1:2:3]', { kind: 'moon', planet: 'p1', min: 1, max: cap }],
      ]);
  });
});

describe('the errors', () => {
  const error = (over = {}) => ({
    id: 3,
    kind: 'server' as const,
    time: 1.7e12,
    first: 1.6e12,
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
    ...over,
  });
  const rowOf = (over = {}) =>
    errorsPage({
      errors: [error(over)],
      page: 1,
      pages: 1,
      count: 1,
      limit: 10,
      before: 0,
    }).table.rows[0]!;

  it('names the kind of each entry', () => {
    expect(rowOf({ kind: 'server' })[1]).toBe('Serverfehler');
    expect(rowOf({ kind: 'client' })[1]).toBe('Browserfehler');
    expect(rowOf({ kind: 'report' })[1]).toBe('Problemmeldung');
  });

  it('shows how often an error came and when it came first, once only for one', () => {
    expect(rowOf()[0]).toBe(dt(1.7e12));
    expect(rowOf({ count: 1500 })[0]).toBe(
      `${dt(1.7e12)} (1.500×, zuerst ${dt(1.6e12)})`,
    );
  });

  it('joins page and action, and shows the text of a report before its message', () => {
    expect(rowOf({ page: '#map', action: 'build' })[3]).toBe('#map / build');
    expect(rowOf({ page: '#map' })[3]).toBe('#map');
    expect(rowOf()[3]).toBe('—');
    expect(rowOf({ report: 'Text', message: 'm' })[4]).toBe('Text');
    expect(rowOf({ message: 'm' })[4]).toBe('m');
    expect(rowOf()[4]).toBe('—');
    expect(rowOf()[2]).toBe('—');
  });

  it('gives details only where there is one, the message of a report among them', () => {
    expect(rowOf()[5]).toBe('—');
    expect(rowOf({ message: 'm' })[5]).toBe('—');
    expect(rowOf({ report: 'Text', message: 'm' })[5]).toEqual({
      kind: 'error',
      detail: {
        id: 3,
        request: null,
        version: null,
        browser: null,
        note: 'm',
        detail: null,
      },
    });
    expect(
      rowOf({ requestId: 'r', version: '1.0', browser: 'B', detail: 'x' })[5],
    ).toMatchObject({
      detail: { request: 'r', version: '1.0', browser: 'B', detail: 'x' },
    });
  });
});

describe('the invitations', () => {
  it('lists address, creation and expiry, each with „Widerrufen“', () => {
    expect(
      invitationsPage([{ id: 'i1', email: 'a@b', created: 1, expires: 2 }]),
    ).toEqual({
      headers: ['Adresse', 'Erstellt', 'Gültig bis', 'Aktion'],
      rows: [['a@b', dt(1), dt(2), { kind: 'revoke', id: 'i1' }]],
    });
  });

  it('has no rows for no invitation', () => {
    expect(invitationsPage([]).rows).toEqual([]);
  });
});

describe('the reported private messages (#226)', () => {
  it('lists sender, recipient, times, reporter and the text', () => {
    expect(
      reportsPage([
        {
          id: 1,
          sender: 'Anna',
          recipient: 'Bert',
          reporter: 'Bert',
          sent: 1,
          reported: 2,
          text: '<b>x</b>',
        },
      ]),
    ).toEqual({
      headers: [
        'Von',
        'An',
        'Gesendet',
        'Gemeldet von',
        'Gemeldet',
        'Nachricht',
      ],
      rows: [['Anna', 'Bert', dt(1), 'Bert', dt(2), '<b>x</b>']],
    });
  });

  it('has no rows for no report', () => {
    expect(reportsPage([]).rows).toEqual([]);
  });
});

describe('„Automatisierung prüfen“ in the player record (#181)', () => {
  const day = Date.UTC(2026, 10, 21);
  it('says whether the check is on and since when', () => {
    expect(botCheckBlock({ since: null, days: [] })).toEqual({
      on: false,
      status: 'Nicht geprüft',
      lines: [],
      empty: '',
    });
    expect(botCheckBlock({ since: day + 3600000, days: [] })).toEqual({
      on: true,
      status: `Geprüft seit ${dt(day + 3600000)}`,
      lines: [],
      empty: 'Noch keine Aktionen seit dem Einschalten.',
    });
  });

  it('writes one line of raw facts per day, the gaps only with two actions or more', () => {
    expect(
      botDayLine({
        day,
        actions: 1234,
        outsidePlay: 12,
        limitHits: 1,
        gaps: { shortest: 0.4, lower: 1.25, median: 2, upper: 10.5 },
      }),
    ).toBe(
      '2026-11-21: 1.234 Aktionen, davon 12 ohne aktive Spielzeit; 1 Treffer der Aktionsgrenze; Abstände: kürzester 0,4 s, Median 2,0 s, mittlere Hälfte 1,3 s bis 10,5 s',
    );
    expect(
      botDayLine({
        day,
        actions: 1,
        outsidePlay: 0,
        limitHits: 0,
        gaps: null,
      }),
    ).toBe(
      '2026-11-21: 1 Aktion, davon 0 ohne aktive Spielzeit; 0 Treffer der Aktionsgrenze',
    );
    const block = botCheckBlock({
      since: day,
      days: [{ day, actions: 2, outsidePlay: 0, limitHits: 0, gaps: null }],
    });
    expect(block.lines).toHaveLength(1);
    expect(block.empty).toBe('');
  });
});
