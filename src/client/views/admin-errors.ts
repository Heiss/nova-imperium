// The admin tab „Fehler“ (issue #126): server errors, browser errors and
// problem reports, newest first with the paging of the event log, and the
// download of a ZIP for a time range (default: the last 7 days).
import { dt, esc, fmt } from '../logic/format.ts';
import { pager, readFilter, table } from './admin-diagnostics.ts';

type Api = (url: string, body: object) => Promise<Record<string, unknown>>;
export type Download = (body: object) => Promise<void>;

interface ErrorRow {
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

interface ErrorPage {
  errors: ErrorRow[];
  page: number;
  pages: number;
  count: number;
  limit: number;
  before: number;
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

/** A date for <input type="date"> in local time, `back` calendar days ago. */
const dateValue = (time: number, back = 0): string => {
  const d = new Date(time);
  d.setDate(d.getDate() - back);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
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

/**
 * Saves the ZIP the server answers with, under the name it gives. A lost
 * session (401) goes to `signedOut`, the same way as every other call.
 */
export async function downloadErrors(
  body: object,
  signedOut: (error: unknown) => never,
): Promise<void> {
  const r = await fetch('/api/admin/errors/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.status === 401) signedOut(j.error);
    throw new Error(j.error ?? 'Der Download ist fehlgeschlagen.');
  }
  const header = r.headers.get('content-disposition') ?? '';
  const name =
    /filename="([^"]+)"/.exec(header)?.[1] ?? 'nova-imperium-fehler.zip';
  const url = URL.createObjectURL(await r.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Loads a page of the list; only the newest request shows its result. */
function listLoader(filter: HTMLFormElement, list: HTMLElement, api: Api) {
  let before = 0;
  let request = 0;
  return async (page?: number): Promise<void> => {
    const id = ++request;
    if (page === undefined) before = 0;
    let data: ErrorPage;
    try {
      data = (await api('/api/admin/errors', {
        ...Object.fromEntries(new FormData(filter)),
        page: page ?? 1,
        before,
      })) as unknown as ErrorPage;
    } catch (error) {
      // A newer list request owns the status; an old failure stays quiet.
      if (id !== request) return;
      throw error;
    }
    if (id !== request) return;
    before = data.before;
    list.innerHTML = pager(data, PAGES) + rows(data.errors);
  };
}

export function mountAdminErrors(
  host: HTMLElement,
  api: Api,
  download: Download,
  now: number,
) {
  host.innerHTML = template(now);
  const filter = host.querySelector<HTMLFormElement>('#errors-filter')!;
  const range = host.querySelector<HTMLFormElement>('#errors-download')!;
  const status = host.querySelector<HTMLElement>('[role=status]')!;
  const list = host.querySelector<HTMLElement>('[data-errors-list]')!;
  const load = listLoader(filter, list, api);
  const run = async (work: () => Promise<void>): Promise<void> => {
    status.hidden = true;
    try {
      await work();
    } catch (error) {
      status.textContent = (error as Error).message;
      status.hidden = false;
    }
  };
  filter.addEventListener('change', () => void run(() => load()));
  range.addEventListener('submit', (event) => {
    event.preventDefault();
    const { since, until } = readFilter(range);
    void run(() => download({ since, until }));
  });
  host.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      'button[data-errors="page"]',
    );
    if (button) void run(() => load(Number(button.dataset.page)));
  });
  return { open: () => run(() => load()) };
}
