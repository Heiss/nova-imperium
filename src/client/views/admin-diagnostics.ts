import { dt, esc, fmt } from '../logic/format.ts';
import type { Players } from '../logic/types.ts';

type Api = (url: string, body: object) => Promise<Record<string, unknown>>;
interface EventRow {
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
interface PlayerStats {
  id: string;
  name: string;
  admin: number;
  lastSeen: number | null;
  activeMs: number;
  actions: number;
  failedLogins: number;
  recentActions: number;
}
interface PlayerDetail {
  days: { day: number; activeMs: number; actions: number }[];
  suspension: { reason: string; until: number | null } | null;
}
interface Order {
  kind: string;
  id: string;
  player: string;
  item: string;
  due: number;
  processed: number | null;
}
interface Invitation {
  id: string;
  email: string;
  created: number;
  expires: number;
}

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
            ? `${fmt(p.recentActions)} Spielaktionen in 1 Min.`
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

export type DiagnosticTab = 'events' | 'players' | 'orders';
type Show = (area: string, html: string) => void;
type Call = (route: string, body?: object) => ReturnType<Api>;

export function mountAdminDiagnostics(
  host: HTMLElement,
  api: Api,
  players: Players,
  navigate: (tab: DiagnosticTab, value?: string) => void,
) {
  host.innerHTML = panelTemplate(players);
  const filter = host.querySelector<HTMLFormElement>('form')!;
  const status = host.querySelector<HTMLElement>('[role=status]')!;
  const show: Show = (area, html) => {
    host.querySelector<HTMLElement>(`[data-admin="${area}"]`)!.innerHTML = html;
  };
  const identify = (id: string | null): string =>
    id ? esc(players[id]?.name ?? id) : '—';
  const call: Call = (route, body = {}) => api(`/api/admin/${route}`, body);
  const controls = diagnosticsControls(host, filter, show, call, identify);
  let request = 0;
  const run = async (work: () => Promise<void>) => {
    const id = ++request;
    status.hidden = true;
    try {
      await work();
    } catch (error) {
      if (id !== request) return;
      status.textContent = (error as Error).message;
      status.hidden = false;
    }
  };
  bindPanel(host, filter, controls, run, call, navigate);
  return {
    open: (tab: DiagnosticTab, value?: string) =>
      run(() => controls.open(tab, value)),
  };
}

function readFilter(filter: HTMLFormElement): Record<string, unknown> {
  const fields = new FormData(filter);
  const date = (name: string, end = false): number => {
    const value = fields.get(name);
    return value
      ? new Date(
          `${String(value)}T${end ? '23:59:59.999' : '00:00:00'}`,
        ).getTime()
      : 0;
  };
  return {
    ...Object.fromEntries(fields),
    since: date('since'),
    until: date('until', true),
  };
}

interface EventPage {
  events: EventRow[];
  page: number;
  pages: number;
  count: number;
  limit: number;
  before: number;
}

function eventPager(data: EventPage): string {
  const { page, pages, count, limit } = data;
  const button = (label: string, icon: string, to: number, disabled: boolean) =>
    `<button type="button" data-diagnostics="page" data-page="${to}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''}>${icon}</button>`;
  return `<div class="flex mt" aria-label="Protokollseiten" role="group">
    ${button('Erste Seite', '«', 1, page === 1)}
    ${button('Vorherige Seite', '‹', page - 1, page === 1)}
    <span role="status">Seite ${page} von ${pages} · ${count} Ereignisse</span>
    ${button('Nächste Seite', '›', page + 1, page === pages)}
    ${button('Letzte Seite', '»', pages, page === pages)}
  </div><p class="dim">${page === 1 ? `Die letzten ${Math.min(count, limit)} Ereignisse` : 'Ältere Ereignisse'}</p>`;
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

function eventLoader(
  filter: HTMLFormElement,
  call: Call,
  show: Show,
  identify: (id: string | null) => string,
) {
  let query: Record<string, unknown> = {};
  let before = 0;
  let request = 0;
  return async (page?: number, player?: string) => {
    const id = ++request;
    if (player !== undefined)
      (filter.elements.namedItem('player') as HTMLSelectElement).value = player;
    if (page === undefined) {
      query = readFilter(filter);
      before = 0;
    }
    const data = (await call('events', {
      ...query,
      page: page ?? 1,
      before,
    })) as unknown as EventPage;
    if (id !== request) return;
    before = data.before;
    show(
      'events',
      '<h3>Ereignisprotokoll</h3>' +
        eventPager(data) +
        eventRows(data.events, identify),
    );
  };
}

function playerLoader(call: Call, show: Show) {
  let selected = '';
  let request = 0;
  return async (player = selected) => {
    selected = player;
    const id = ++request;
    const [stats, detail] = await Promise.all([
      call('stats'),
      player ? call('player', { player }) : null,
    ]);
    if (id !== request) return;
    const people = stats.players as PlayerStats[];
    show('stats', statsPanel(people));
    const person = people.find((p) => p.id === player);
    show(
      'player',
      detail && person
        ? playerPanel(person, detail as unknown as PlayerDetail)
        : '',
    );
  };
}

function diagnosticsControls(
  host: HTMLElement,
  filter: HTMLFormElement,
  show: Show,
  call: Call,
  identify: (id: string | null) => string,
) {
  const events = eventLoader(filter, call, show, identify);
  const players = playerLoader(call, show);
  const orders = async (reference = '') => {
    const result = await call('orders', { reference });
    show(
      'orders',
      orderPanel(result.orders as Order[], Number(result.now), identify),
    );
  };
  const open = (tab: DiagnosticTab, value?: string) => {
    filter.hidden = tab !== 'events';
    for (const section of host.querySelectorAll<HTMLElement>('[data-admin]')) {
      const area = section.dataset.admin;
      section.hidden =
        tab === 'players'
          ? area !== 'stats' && area !== 'player'
          : area !== tab;
    }
    if (tab === 'events') return events(undefined, value);
    if (tab === 'players') return players(value);
    return orders(value);
  };
  return { open, events, players };
}

function playerButton(id: string, name: string): string {
  return `<button type="button" data-diagnostics="player" data-player="${esc(id)}">${esc(name)}</button>`;
}

function eventDetail(row: EventRow): string {
  const detail = JSON.parse(row.detail) as { fleet?: string; planet?: string };
  const refs = [detail.planet, detail.fleet].filter((id) => id !== undefined);
  const links = refs
    .map(
      (id) =>
        `<button type="button" data-diagnostics="orders" data-reference="${esc(id)}">Aufträge zu ${esc(id)}</button>`,
    )
    .join(' ');
  const request = row.requestId
    ? `<div>Vorgang <code>${esc(row.requestId)}</code></div>`
    : '';
  const title = row.action === 'battle' ? 'Kampfdetails' : 'Ereignis';
  return `<details><summary>${title} ${row.id}</summary>${request}<code>${esc(row.detail)}</code><div class="flex">${links}</div></details>`;
}

function bindPanel(
  host: HTMLElement,
  filter: HTMLFormElement,
  controls: ReturnType<typeof diagnosticsControls>,
  run: (work: () => Promise<void>) => Promise<void>,
  call: Call,
  navigate: (tab: DiagnosticTab, value?: string) => void,
) {
  filter.addEventListener('submit', (event) => {
    event.preventDefault();
    void run(() => controls.events());
  });
  filter
    .querySelector('select[name=limit]')
    ?.addEventListener('change', () => void run(() => controls.events()));
  const actions: Record<string, (d: DOMStringMap) => void> = {
    page: (d) => void run(() => controls.events(Number(d.page))),
    player: (d) => navigate('players', d.player),
    orders: (d) => navigate('orders', d.reference),
    playerEvents: (d) => navigate('events', d.player),
    reference: (d) => {
      (filter.elements.namedItem('reference') as HTMLInputElement).value =
        d.reference ?? '';
      navigate('events');
    },
  };
  host.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      'button[data-diagnostics]',
    );
    if (button) actions[button.dataset.diagnostics!]?.(button.dataset);
  });
  host.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (form.id !== 'moderation-form') return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!window.confirm('Diesen Eingriff ausführen?')) return;
    void run(async () => {
      await call('moderate', values);
      await controls.players();
    });
  });
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
    controls
  );
}

const invitationLoads = new WeakMap<HTMLElement, object>();

export async function loadInvitations(
  host: HTMLElement,
  api: Api,
): Promise<void> {
  const current = {};
  invitationLoads.set(host, current);
  try {
    const reply = await api('/api/admin/invitations', {});
    if (invitationLoads.get(host) !== current) return;
    host.innerHTML = table(
      ['Adresse', 'Erstellt', 'Gültig bis', 'Aktion'],
      (reply.invitations as Invitation[]).map((i) => [
        esc(i.email),
        dt(i.created),
        dt(i.expires),
        `<button class="small red" data-act="revoke" data-id="${esc(i.id)}">Widerrufen</button>`,
      ]),
    );
  } catch (error) {
    if (invitationLoads.get(host) === current)
      host.textContent = (error as Error).message;
  }
}
