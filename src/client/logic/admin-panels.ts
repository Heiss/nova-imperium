// What the panels of the page „Admin“ that fill themselves from the server
// show (#118, after bundle 7; okf/architecture/patterns.md, section 9),
// without the HTML of their parts: the diagnostics (event log, player
// records, orders), the errors and the list of the invitations. The
// components AdminDiagnostics, AdminErrors and AdminInvitations render it;
// the state they read and the calls that fill it are
// logic/admin-panels.svelte.ts. The texts and the columns are those of the
// DOM modules these panels were before.
import { MAX_MOON_CHANCE, MIN_MOON_CHANCE } from '../../core/moon.ts';
import { dt, fmt } from './format.ts';
import type { Players } from './types.ts';

export interface EventRow {
  id: number;
  time: number;
  actor: string | null;
  actorName: string | null;
  category: string;
  action: string;
  outcome: string;
  target: string | null;
  requestId: string | null;
  detail: string;
}
export interface PlayerStats {
  id: string;
  name: string;
  admin: number;
  lastSeen: number | null;
  activeMs: number;
  actions: number;
  failedLogins: number;
  recentActions: number;
}
interface PlayerPlanet {
  id: string;
  name: string;
  g: number;
  s: number;
  p: number;
  moon: boolean;
}
export interface PlayerDetail {
  days: { day: number; activeMs: number; actions: number }[];
  suspension: { reason: string; until: number | null } | null;
  /** The planets of the player, for „Mond anlegen“ (#53). */
  planets: PlayerPlanet[];
}
export interface Order {
  kind: string;
  id: string;
  player: string;
  item: string;
  due: number;
  processed: number | null;
}
export interface Invitation {
  id: string;
  email: string;
  created: number;
  expires: number;
}
/** A reported private message (#226): a copy of the text, the players and the times. */
export interface MessageReport {
  id: number;
  sender: string;
  recipient: string;
  reporter: string;
  sent: number;
  reported: number;
  text: string;
}
export interface EventPage {
  events: EventRow[];
  page: number;
  pages: number;
  count: number;
  limit: number;
  before: number;
}
export interface ErrorRow {
  id: number;
  kind: 'server' | 'client' | 'report';
  time: number;
  first: number;
  playerName: string | null;
  requestId: string | null;
  action: string;
  page: string;
  version: string;
  browser: string;
  message: string;
  detail: string;
  count: number;
  report: string;
}
export interface ErrorPage {
  errors: ErrorRow[];
  page: number;
  pages: number;
  count: number;
  limit: number;
  before: number;
}

/** One cell of a table: a text, or a button, a form or the details of a row. */
export type Cell =
  | string
  | { kind: 'player'; id: string; name: string }
  | { kind: 'reference'; id: string }
  | { kind: 'event'; detail: EventDetail }
  | { kind: 'error'; detail: ErrorDetail }
  | { kind: 'moon'; planet: string; min: number; max: number }
  | { kind: 'revoke'; id: string };

/** A table of a panel; no rows means the line „Keine Einträge.“. */
export interface TablePage {
  headers: string[];
  rows: Cell[][];
}

const table = (headers: string[], rows: Cell[][]): TablePage => ({
  headers,
  rows,
});

const minutes = (ms: number): string => fmt(Math.round(ms / 60000));

/** A player of the filter and of the tables, by name; an unknown id is its own name. */
export const nameOf = (players: Players, id: string | null): string =>
  id ? (players[id]?.name ?? id) : '—';

// ----- the filter and the dates -----

/** The fields of the filter of the event log; all text, as a form gives them. */
export type Fields = Record<string, string>;

export const EVENT_FIELDS: Fields = {
  player: '',
  action: '',
  outcome: '',
  requestId: '',
  reference: '',
  since: '',
  until: '',
  limit: '10',
};

/** A day typed into a date field as the time its first (or, with `end`, last) millisecond is, local time; 0 for none. */
export const dayTime = (value: string | undefined, end = false): number =>
  value
    ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`).getTime()
    : 0;

/** What a filter sends: its fields, the days as times. */
export const dayQuery = (fields: Fields): Record<string, unknown> => ({
  ...fields,
  since: dayTime(fields.since),
  until: dayTime(fields.until, true),
});

/** A date for <input type="date"> in local time, `back` calendar days ago. */
export const dateValue = (time: number, back = 0): string => {
  const d = new Date(time);
  d.setDate(d.getDate() - back);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

/** The days of the download of the errors: the last 7 calendar days, today and the six before, whole days. */
export const errorRange = (now: number): Fields => ({
  since: dateValue(now, 6),
  until: dateValue(now),
});

// ----- the pages of a list -----

/** The words of the page buttons of a list. */
export interface PagerWords {
  /** The data attribute the page buttons carry, e.g. `diagnostics`. */
  attribute: 'diagnostics' | 'errors';
  group: string;
  items: string;
}

export const EVENT_PAGES: PagerWords = {
  attribute: 'diagnostics',
  group: 'Protokollseiten',
  items: 'Ereignisse',
};

export const ERROR_PAGES: PagerWords = {
  attribute: 'errors',
  group: 'Fehlerseiten',
  items: 'Einträge',
};

export interface PagerPage {
  attribute: PagerWords['attribute'];
  group: string;
  buttons: { label: string; icon: string; to: number; disabled: boolean }[];
  status: string;
  note: string;
}

/** First, previous, next and last page of a list. */
export function pagerPage(
  data: Pick<EventPage, 'page' | 'pages' | 'count' | 'limit'>,
  words: PagerWords,
): PagerPage {
  const { page, pages, count, limit } = data;
  const button = (
    label: string,
    icon: string,
    to: number,
    disabled: boolean,
  ) => ({
    label,
    icon,
    to,
    disabled,
  });
  return {
    attribute: words.attribute,
    group: words.group,
    buttons: [
      button('Erste Seite', '«', 1, page === 1),
      button('Vorherige Seite', '‹', page - 1, page === 1),
      button('Nächste Seite', '›', page + 1, page === pages),
      button('Letzte Seite', '»', pages, page === pages),
    ],
    status: `Seite ${page} von ${pages} · ${count} ${words.items}`,
    note:
      page === 1
        ? `Die letzten ${Math.min(count, limit)} ${words.items}`
        : `Ältere ${words.items}`,
  };
}

// ----- the event log -----

/** The details of an event: a button per planet and fleet reference that filters the log by it (#151). */
export interface EventDetail {
  title: string;
  id: number;
  request: string | null;
  raw: string;
  references: string[];
}

/**
 * The details of an event, with a button per planet and fleet reference that
 * filters the event log by it (#151): unlike the open orders, the events of a
 * reference stay after its order is gone.
 */
export function eventDetail(row: EventRow): EventDetail {
  const detail = JSON.parse(row.detail) as { fleet?: string; planet?: string };
  return {
    title: row.action === 'battle' ? 'Kampfdetails' : 'Ereignis',
    id: row.id,
    request: row.requestId || null,
    raw: row.detail,
    references: [detail.planet, detail.fleet].filter(
      (id): id is string => id !== undefined,
    ),
  };
}

/** The event log as a table and its page buttons. */
export function eventsPage(data: EventPage, players: Players) {
  return {
    pager: pagerPage(data, EVENT_PAGES),
    table: table(
      ['Zeit', 'Akteur', 'Kategorie / Aktion', 'Ergebnis', 'Ziel', 'Details'],
      data.events.map((r): Cell[] => [
        dt(r.time),
        r.actorName && r.actor
          ? { kind: 'player', id: r.actor, name: r.actorName }
          : nameOf(players, r.actor),
        `${r.category} / ${r.action}`,
        r.outcome,
        nameOf(players, r.target),
        { kind: 'event', detail: eventDetail(r) },
      ]),
    ),
  };
}

// ----- the player records and the orders -----

/** What the audit notes about a player in one line: failed logins and many actions. */
const hints = (p: PlayerStats): string =>
  [
    p.failedLogins >= 5
      ? `${fmt(p.failedLogins)} abgelehnte Logins in 1 Std.`
      : '',
    p.recentActions >= 30 ? `${fmt(p.recentActions)} Aktionen in 1 Min.` : '',
  ]
    .filter(Boolean)
    .join(' · ') || '—';

/** The table „Spielaktivität“. */
export const statsPage = (people: PlayerStats[]): TablePage =>
  table(
    [
      'Spielerakte',
      'Zuletzt aktiv',
      'Aktive Min.',
      'Aktionen',
      'Hinweise zur Prüfung',
    ],
    people.map((p): Cell[] => [
      { kind: 'player', id: p.id, name: p.name },
      p.lastSeen === null ? '—' : dt(p.lastSeen),
      minutes(p.activeMs),
      fmt(p.actions),
      hints(p),
    ]),
  );

/** The table „Aufträge“; an order is due when its time has come. */
export const ordersPage = (
  orders: Order[],
  now: number,
  players: Players,
): TablePage =>
  table(
    [
      'Typ / Auftrag',
      'Spieler',
      'Referenz',
      'Sollzeit',
      'Status',
      'Letzter Planetenstand',
    ],
    orders.map((o): Cell[] => [
      `${o.kind} / ${o.item}`,
      nameOf(players, o.player),
      { kind: 'reference', id: o.id },
      dt(o.due),
      o.due <= now ? 'Fällig' : 'Läuft',
      o.processed === null ? '—' : dt(o.processed),
    ]),
  );

/** The record of a player: the state of the access, the days, the planets and, for a player who is no admin, the moderation. */
export function playerPage(person: PlayerStats, detail: PlayerDetail) {
  const blocked = detail.suspension;
  return {
    heading: `Spielerakte · ${person.name}`,
    id: person.id,
    status: blocked
      ? `Gesperrt ${blocked.until === null ? 'bis zur Freigabe' : 'bis ' + dt(blocked.until)} · ${blocked.reason}`
      : 'Spielerzugang aktiv',
    moderation: !person.admin,
    days: table(
      ['Tag (UTC)', 'Aktive Min.', 'Aktionen'],
      detail.days.map((d): Cell[] => [
        new Date(d.day).toISOString().slice(0, 10),
        minutes(d.activeMs),
        fmt(d.actions),
      ]),
    ),
    planets: table(
      ['Planet', 'Position', 'Mond'],
      detail.planets.map((x): Cell[] => [
        x.name,
        `[${x.g}:${x.s}:${x.p}]`,
        // A planet without a moon: a chance of 1 to 20 % for the diameter (#53; owner, 2026-11-14).
        x.moon
          ? 'vorhanden'
          : {
              kind: 'moon',
              planet: x.id,
              min: MIN_MOON_CHANCE,
              max: MAX_MOON_CHANCE,
            },
      ]),
    ),
  };
}

// ----- the errors -----

const KINDS = {
  server: 'Serverfehler',
  client: 'Browserfehler',
  report: 'Problemmeldung',
} as const;

/** The parts of the details of an error; none of them gives „—“. */
interface ErrorDetail {
  id: number;
  request: string | null;
  version: string | null;
  browser: string | null;
  note: string | null;
  detail: string | null;
}

const errorDetail = (e: ErrorRow): Cell => {
  const detail = {
    id: e.id,
    request: e.requestId || null,
    version: e.version || null,
    browser: e.browser || null,
    note: e.report && e.message ? e.message : null,
    detail: e.detail || null,
  };
  return Object.values({ ...detail, id: null }).some(Boolean)
    ? { kind: 'error', detail }
    : '—';
};

/** The list of the errors as a table and its page buttons. */
export function errorsPage(data: ErrorPage) {
  return {
    pager: pagerPage(data, ERROR_PAGES),
    table: table(
      ['Zeit', 'Art', 'Spieler', 'Seite / Aktion', 'Meldung', 'Details'],
      data.errors.map((e): Cell[] => [
        dt(e.time) +
          (e.count > 1 ? ` (${fmt(e.count)}×, zuerst ${dt(e.first)})` : ''),
        KINDS[e.kind],
        e.playerName ?? '—',
        [e.page, e.action].filter(Boolean).join(' / ') || '—',
        e.report || e.message || '—',
        errorDetail(e),
      ]),
    ),
  };
}

// ----- the invitations -----

/** The table of the open invitations, each with „Widerrufen“. */
export const invitationsPage = (list: Invitation[]): TablePage =>
  table(
    ['Adresse', 'Erstellt', 'Gültig bis', 'Aktion'],
    list.map((i): Cell[] => [
      i.email,
      dt(i.created),
      dt(i.expires),
      { kind: 'revoke', id: i.id },
    ]),
  );

/** The reported private messages (#226, Q24): the message with its sender, recipient, time and the player who reported it [V]. */
export const reportsPage = (list: MessageReport[]): TablePage =>
  table(
    ['Von', 'An', 'Gesendet', 'Gemeldet von', 'Gemeldet', 'Nachricht'],
    list.map((r): Cell[] => [
      r.sender,
      r.recipient,
      dt(r.sent),
      r.reporter,
      dt(r.reported),
      r.text,
    ]),
  );
