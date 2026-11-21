// The panels of the page „Admin“ that fill themselves as they were drawn
// before #118 (after bundle 7): the diagnostics, the errors and the list of
// the invitations, as HTML strings, frozen for the reference test
// (admin-panels-reference.test.ts). The code is that of
// src/client/views/admin-diagnostics.ts and admin-errors.ts as they were,
// the lines that read or changed the DOM left out; `diagnosticsPanel()`,
// `errorsPanel()` and `invitationList()` put the parts together as the
// browser showed them after the panel had opened a tab. The date for the
// download of the errors is the helper of the new code (a calendar, no markup).
import { MAX_MOON_CHANCE, MIN_MOON_CHANCE } from '../core/moon.ts';
import { dt, esc, fmt } from '../client/logic/format.ts';
import { dateValue } from '../client/logic/admin-panels.ts';
import type {
  ErrorPage,
  ErrorRow,
  EventPage,
  EventRow,
  Invitation,
  Order,
  PlayerDetail,
  PlayerStats,
} from '../client/logic/admin-panels.ts';
import type { Players } from '../client/logic/types.ts';

type PlayerPlanet = PlayerDetail['planets'][number];

const minutes = (ms: number): string => fmt(Math.round(ms / 60000));
const table = (headers: string[], rows: string[][]): string =>
  rows.length
    ? `<div class="admin-table"><table class="mini"><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
       <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '<p class="dim">Keine Einträge.</p>';

function panelTemplate(players: Players): string {
  return `
    <form id="diagnostics-filter">
      <div class="flex">
        <label for="audit-player">Spieler</label><select id="audit-player" name="player"><option value="">Alle</option>${Object.entries(
          players,
        )
          .map(
            ([id, p]) => `<option value="${esc(id)}">${esc(p.name)}</option>`,
          )
          .join('')}</select>
        <label>Aktion <input name="action" maxlength="40" placeholder="z. B. build"></label>
        <label for="audit-outcome">Ergebnis</label><select id="audit-outcome" name="outcome"><option value="">Alle</option><option value="ok">Erfolgreich</option><option value="rejected">Abgelehnt</option><option value="error">Fehler</option></select>
        <label>Vorgangs-ID <input name="requestId" maxlength="36"></label>
        <label>Planet / Flotte <input name="reference" maxlength="40"></label>
        <label>Von <input type="date" name="since"></label>
        <label>Bis <input type="date" name="until"></label>
        <label>Pro Seite <select name="limit"><option>10</option><option>25</option><option>50</option><option>100</option></select></label>
        <button type="submit">Anzeigen</button>
      </div>
    </form>
    <p class="notice" role="status" hidden></p>
    <section data-admin="stats"></section>
    <section data-admin="player"></section>
    <section data-admin="orders"></section>
    <section data-admin="events"></section>`;
}

function statsPanel(people: PlayerStats[]): string {
  return (
    '<h3>Spielaktivität</h3><p class="dim">Heute und die letzten sechs UTC-Tage. Die aktive Zeit ist aus Interaktionen geschätzt.</p>' +
    table(
      [
        'Spielerakte',
        'Zuletzt aktiv',
        'Aktive Min.',
        'Aktionen',
        'Hinweise zur Prüfung',
      ],
      people.map((p) => [
        `<button type="button" data-diagnostics="player" data-player="${esc(p.id)}">${esc(p.name)}</button>`,
        p.lastSeen === null ? '—' : dt(p.lastSeen),
        minutes(p.activeMs),
        fmt(p.actions),
        [
          p.failedLogins >= 5
            ? `${fmt(p.failedLogins)} abgelehnte Logins in 1 Std.`
            : '',
          p.recentActions >= 30
            ? // Renamed on purpose (coordinator, 2026-11-21): the player's own
              // „Spielaktionen“ count only changes and clicks since #335.
              `${fmt(p.recentActions)} Aktionen in 1 Min.`
            : '',
        ]
          .filter(Boolean)
          .join(' · ') || '—',
      ]),
    )
  );
}

function orderPanel(
  orders: Order[],
  now: number,
  identify: (id: string) => string,
): string {
  return (
    '<h3>Aufträge</h3><p class="dim">Die nächsten 100 nach Sollzeit. Gebäude, Forschung und Schiffsschmiede können beim Abruf des Spielzustands berechnet werden.</p>' +
    table(
      [
        'Typ / Auftrag',
        'Spieler',
        'Referenz',
        'Sollzeit',
        'Status',
        'Letzter Planetenstand',
      ],
      orders.map((o) => [
        `${esc(o.kind)} / ${esc(o.item)}`,
        identify(o.player),
        `<button type="button" data-diagnostics="reference" data-reference="${esc(o.id)}">${esc(o.id)}</button>`,
        dt(o.due),
        o.due <= now ? 'Fällig' : 'Läuft',
        o.processed === null ? '—' : dt(o.processed),
      ]),
    )
  );
}

interface PagerWords {
  /** The data attribute the page buttons carry, e.g. `data-diagnostics`. */
  attribute: string;
  group: string;
  items: string;
}

const EVENT_PAGES: PagerWords = {
  attribute: 'data-diagnostics',
  group: 'Protokollseiten',
  items: 'Ereignisse',
};

/** First, previous, next and last page of an admin list. */
function pager(
  data: Pick<EventPage, 'page' | 'pages' | 'count' | 'limit'>,
  words: PagerWords = EVENT_PAGES,
): string {
  const { page, pages, count, limit } = data;
  const button = (label: string, icon: string, to: number, disabled: boolean) =>
    `<button type="button" ${words.attribute}="page" data-page="${to}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''}>${icon}</button>`;
  return `<div class="flex mt" aria-label="${words.group}" role="group">
    ${button('Erste Seite', '«', 1, page === 1)}
    ${button('Vorherige Seite', '‹', page - 1, page === 1)}
    <span role="status">Seite ${page} von ${pages} · ${count} ${words.items}</span>
    ${button('Nächste Seite', '›', page + 1, page === pages)}
    ${button('Letzte Seite', '»', pages, page === pages)}
  </div><p class="dim">${page === 1 ? `Die letzten ${Math.min(count, limit)} ${words.items}` : `Ältere ${words.items}`}</p>`;
}

function eventRows(
  rows: EventRow[],
  identify: (id: string | null) => string,
): string {
  return table(
    ['Zeit', 'Akteur', 'Kategorie / Aktion', 'Ergebnis', 'Ziel', 'Details'],
    rows.map((r) => [
      dt(r.time),
      r.actorName && r.actor
        ? playerButton(r.actor, r.actorName)
        : identify(r.actor),
      `${esc(r.category)} / ${esc(r.action)}`,
      esc(r.outcome),
      identify(r.target),
      eventDetail(r),
    ]),
  );
}

function playerButton(id: string, name: string): string {
  return `<button type="button" data-diagnostics="player" data-player="${esc(id)}">${esc(name)}</button>`;
}

/**
 * The details of an event, with a button per planet and fleet reference that
 * filters the event log by it (#151): unlike the open orders, the events of a
 * reference stay after its order is gone.
 */
function eventDetail(row: EventRow): string {
  const detail = JSON.parse(row.detail) as { fleet?: string; planet?: string };
  const refs = [detail.planet, detail.fleet].filter((id) => id !== undefined);
  const links = refs
    .map(
      (id) =>
        `<button type="button" data-diagnostics="reference" data-reference="${esc(id)}">Ereignisse zu ${esc(id)}</button>`,
    )
    .join(' ');
  const request = row.requestId
    ? `<div>Vorgang <code>${esc(row.requestId)}</code></div>`
    : '';
  const title = row.action === 'battle' ? 'Kampfdetails' : 'Ereignis';
  return `<details><summary>${title} ${row.id}</summary>${request}<code>${esc(row.detail)}</code><div class="flex">${links}</div></details>`;
}

/**
 * The planets of the player, each without a moon with „Mond anlegen“ and a
 * chance of 1 to 20 % for the diameter (#53; owner, 2026-11-14).
 */
function planetPanel(planets: PlayerPlanet[]): string {
  return (
    '<h4>Planeten</h4>' +
    table(
      ['Planet', 'Position', 'Mond'],
      planets.map((x) => [
        esc(x.name),
        `[${x.g}:${x.s}:${x.p}]`,
        x.moon
          ? 'vorhanden'
          : `<form class="moon-form flex" data-planet="${esc(x.id)}"><label>Mondchance in % <input name="chance" type="number" min="${MIN_MOON_CHANCE}" max="${MAX_MOON_CHANCE}" required></label><button type="submit">Mond anlegen</button></form>`,
      ]),
    )
  );
}

function playerPanel(person: PlayerStats, detail: PlayerDetail): string {
  const blocked = detail.suspension;
  const status = blocked
    ? `Gesperrt ${blocked.until === null ? 'bis zur Freigabe' : 'bis ' + dt(blocked.until)} · ${esc(blocked.reason)}`
    : 'Spielerzugang aktiv';
  const controls = person.admin
    ? ''
    : `<form id="moderation-form" class="flex">
    <input type="hidden" name="player" value="${esc(person.id)}">
    <label>Eingriff <select name="action"><option value="revokeSessions">Sitzungen beenden</option><option value="ban">Sperren</option><option value="unban">Freigeben</option></select></label>
    <label>Sperrdauer in Stunden (0 = unbefristet) <input name="hours" type="number" min="0" max="720" value="0"></label>
    <label>Grund <input name="reason" maxlength="200" required></label>
    <button type="submit">Ausführen</button>
  </form>`;
  return (
    `<h3>Spielerakte · ${esc(person.name)}</h3><p>${status}</p><button type="button" data-diagnostics="playerEvents" data-player="${esc(person.id)}">Ereignisse zu diesem Spieler</button>` +
    table(
      ['Tag (UTC)', 'Aktive Min.', 'Aktionen'],
      detail.days.map((d) => [
        new Date(d.day).toISOString().slice(0, 10),
        minutes(d.activeMs),
        fmt(d.actions),
      ]),
    ) +
    planetPanel(detail.planets) +
    controls
  );
}

const KINDS = {
  server: 'Serverfehler',
  client: 'Browserfehler',
  report: 'Problemmeldung',
} as const;

const PAGES = {
  attribute: 'data-errors',
  group: 'Fehlerseiten',
  items: 'Einträge',
};

// The last 7 calendar days: today and the six before, whole days, like the
// server's default of 7 days (readFilter takes the start of the first and
// the end of the last day).
function template(now: number): string {
  return `
    <form id="errors-download" class="flex">
      <label>Zeitraum von <input type="date" name="since" value="${dateValue(now, 6)}" required></label>
      <label>bis <input type="date" name="until" value="${dateValue(now)}" required></label>
      <button type="submit">Herunterladen</button>
    </form>
    <p class="dim">ZIP mit Fehlern, Problemmeldungen und dem Ereignisprotokoll als JSON Lines, mit Spielernamen.</p>
    <form id="errors-filter" class="flex mt">
      <label>Art <select name="kind"><option value="">Alle</option><option value="server">Serverfehler</option><option value="client">Browserfehler</option><option value="report">Problemmeldungen</option></select></label>
      <label>Anzahl je Seite <select name="limit"><option>10</option><option>25</option><option>50</option><option>100</option></select></label>
    </form>
    <p class="notice" role="status" hidden></p>
    <div data-errors-list></div>`;
}

function details(e: ErrorRow): string {
  const parts = [
    e.requestId ? `<div>Vorgang <code>${esc(e.requestId)}</code></div>` : '',
    e.version ? `<div>Version ${esc(e.version)}</div>` : '',
    e.browser ? `<div>Browser ${esc(e.browser)}</div>` : '',
    e.report && e.message ? `<div>Meldung ${esc(e.message)}</div>` : '',
    e.detail ? `<pre>${esc(e.detail)}</pre>` : '',
  ].join('');
  return parts
    ? `<details><summary>Eintrag ${e.id}</summary>${parts}</details>`
    : '—';
}

function rows(errors: ErrorRow[]): string {
  return table(
    ['Zeit', 'Art', 'Spieler', 'Seite / Aktion', 'Meldung', 'Details'],
    errors.map((e) => [
      dt(e.time) +
        (e.count > 1 ? ` (${fmt(e.count)}×, zuerst ${dt(e.first)})` : ''),
      KINDS[e.kind],
      esc(e.playerName ?? '—'),
      esc([e.page, e.action].filter(Boolean).join(' / ') || '—'),
      esc(e.report || e.message || '—'),
      details(e),
    ]),
  );
}

/** What a panel of the diagnostics holds after the tab loaded its data. */
export interface Loaded {
  tab: 'events' | 'players' | 'orders';
  events?: EventPage;
  stats?: PlayerStats[];
  record?: { person: PlayerStats; detail: PlayerDetail };
  orders?: { orders: Order[]; now: number };
  notice?: string;
}

/** The panel „Diagnose und Protokoll“ as the browser showed it. */
export function diagnosticsPanel(players: Players, x: Loaded): string {
  const identify = (id: string | null): string =>
    id ? esc(players[id]?.name ?? id) : '—';
  const hide = (hidden: boolean): string => (hidden ? ' hidden' : '');
  const sections = {
    stats: x.stats ? statsPanel(x.stats) : '',
    player: x.record ? playerPanel(x.record.person, x.record.detail) : '',
    orders: x.orders ? orderPanel(x.orders.orders, x.orders.now, identify) : '',
    events: x.events
      ? '<h3>Ereignisprotokoll</h3>' +
        pager(x.events) +
        eventRows(x.events.events, identify)
      : '',
  };
  const hidden = (area: string): boolean =>
    x.tab === 'players'
      ? area !== 'stats' && area !== 'player'
      : area !== x.tab;
  const form = panelTemplate(players)
    .replace(
      '<form id="diagnostics-filter">',
      `<form id="diagnostics-filter"${hide(x.tab !== 'events')}>`,
    )
    .replace(
      '<p class="notice" role="status" hidden></p>',
      `<p class="notice" role="status"${hide(x.notice === undefined)}>${esc(x.notice ?? '')}</p>`,
    );
  let html = form;
  for (const [area, content] of Object.entries(sections))
    html = html.replace(
      `<section data-admin="${area}"></section>`,
      `<section data-admin="${area}"${hide(hidden(area))}>${content}</section>`,
    );
  return html;
}

/** The panel „Fehler“ as the browser showed it. */
export function errorsPanel(
  now: number,
  data?: ErrorPage,
  notice?: string,
): string {
  const list = data ? pager(data, PAGES) + rows(data.errors) : '';
  return template(now)
    .replace(
      '<p class="notice" role="status" hidden></p>',
      `<p class="notice" role="status"${notice === undefined ? ' hidden' : ''}>${esc(notice ?? '')}</p>`,
    )
    .replace(
      '<div data-errors-list></div>',
      `<div data-errors-list>${list}</div>`,
    );
}

/** The list of the invitations as loadInvitations() wrote it. */
export const invitationList = (list: Invitation[]): string =>
  table(
    ['Adresse', 'Erstellt', 'Gültig bis', 'Aktion'],
    list.map((i) => [
      esc(i.email),
      dt(i.created),
      dt(i.expires),
      `<button class="small red" data-act="revoke" data-id="${esc(i.id)}">Widerrufen</button>`,
    ]),
  );
