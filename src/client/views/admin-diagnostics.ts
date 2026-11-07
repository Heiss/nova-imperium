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
    '<h3>Aufträge</h3><p class="dim">Die nächsten 100 nach Sollzeit. Gebäude, Forschung und Werft können beim Abruf des Spielzustands berechnet werden.</p>' +
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

export function mountAdminDiagnostics(
  host: HTMLElement,
  api: Api,
  players: Players,
) {
  host.innerHTML = panelTemplate(players);
  const filter = host.querySelector<HTMLFormElement>('#diagnostics-filter')!;
  const status = host.querySelector<HTMLElement>('[role=status]')!;
  const show = (area: string, html: string) => {
    host.querySelector<HTMLElement>(`[data-admin="${area}"]`)!.innerHTML = html;
  };
  const identify = (id: string | null): string =>
    id ? esc(players[id]?.name ?? id) : '—';
  const call = (route: string, body: object = {}) =>
    api(`/api/admin/${route}`, body);
  const notify = (message: string) => {
    status.textContent = message;
    status.hidden = !message;
  };
  let loading = false;

  const actions = panelActions(host, filter, call, show, identify);
  async function run(work: () => Promise<void>) {
    if (loading) return;
    loading = true;
    notify('');
    try {
      await work();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      loading = false;
    }
  }

  bindPanel(host, filter, actions, run, call, notify);
  return { refresh: () => run(actions.loadOverview) };
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

function panelActions(
  host: HTMLElement,
  filter: HTMLFormElement,
  call: (route: string, body?: object) => ReturnType<Api>,
  show: (area: string, html: string) => void,
  identify: (id: string | null) => string,
) {
  let page: Record<string, unknown> = {};
  let cursor = 0;
  const loadEvents = (append: boolean) =>
    eventPage(
      host,
      call,
      show,
      identify,
      { ...page, ...(append ? { before: cursor } : {}) },
      append,
    ).then((next) => {
      cursor = next;
    });

  async function loadOverview() {
    page = readFilter(filter);
    const player = page.player as string;
    const [stats, jobs, detail] = await Promise.all([
      call('stats'),
      call('orders', { player, reference: page.reference }),
      player ? call('player', { player }) : null,
    ]);
    await loadEvents(false);
    const people = stats.players as PlayerStats[];
    show('stats', statsPanel(people));
    const person = people.find((p) => p.id === player);
    show(
      'player',
      detail && person
        ? playerPanel(person, detail as unknown as PlayerDetail)
        : '',
    );
    show(
      'orders',
      orderPanel(jobs.orders as Order[], Number(jobs.now), identify),
    );
  }

  return { loadEvents, loadOverview };
}

async function eventPage(
  host: HTMLElement,
  call: (route: string, body?: object) => ReturnType<Api>,
  show: (area: string, html: string) => void,
  identify: (id: string | null) => string,
  page: object,
  append: boolean,
): Promise<number> {
  const data = await call('events', page);
  const rows = data.events as EventRow[];

  const eventTable = table(
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
  const more = data.more
    ? '<button type="button" data-diagnostics="more">Ältere Ereignisse</button>'
    : '';
  if (append) {
    host.querySelector('[data-diagnostics="more"]')?.remove();
    host
      .querySelector('[data-admin="events"]')!
      .insertAdjacentHTML('beforeend', eventTable + more);
  } else show('events', '<h3>Ereignisprotokoll</h3>' + eventTable + more);
  return rows.at(-1)?.id ?? 0;
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
        `<button type="button" data-diagnostics="reference" data-reference="${esc(id)}">Aufträge zu ${esc(id)}</button>`,
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
  actions: ReturnType<typeof panelActions>,
  run: (work: () => Promise<void>) => Promise<void>,
  call: (route: string, body?: object) => ReturnType<Api>,
  notify: (message: string) => void,
) {
  const playerSelect = filter.elements.namedItem('player') as HTMLSelectElement;
  filter.addEventListener('submit', (event) => {
    event.preventDefault();
    void run(actions.loadOverview);
  });
  host.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      'button[data-diagnostics]',
    );
    if (button?.dataset.diagnostics === 'more')
      void run(() => actions.loadEvents(true));
    if (button?.dataset.diagnostics === 'reference') {
      filter.reset();
      (filter.elements.namedItem('reference') as HTMLInputElement).value =
        button.dataset.reference ?? '';
      void run(actions.loadOverview);
    }
    if (button?.dataset.diagnostics === 'player') {
      filter.reset();
      playerSelect.value = button.dataset.player ?? '';
      void run(actions.loadOverview);
    }
  });
  host.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (form.id !== 'moderation-form') return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!window.confirm('Diesen Eingriff ausführen?')) return;
    void run(async () => {
      await call('moderate', values);
      await actions.loadOverview();
      notify('Eingriff ausgeführt.');
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
    `<h3>Spielerakte · ${esc(person.name)}</h3><p>${status}</p>` +
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
