// The state of the panels of the page „Admin“ that fill themselves from the
// server, and the calls that fill it (#118, after bundle 7;
// okf/architecture/patterns.md, section 9): the diagnostics (event log, player
// records, orders), the errors and the list of the invitations. The page is
// mounted anew on every render, so what the panels loaded and what was typed
// into their filters lives here, as long as it is the same admin; the
// components AdminDiagnostics, AdminErrors and AdminInvitations read it. This
// module also holds the tab that is shown and loads what the tab needs.
import { ADMIN_TABS, type AdminTab, diagnosticTab } from './admin.ts';
import {
  dayQuery,
  dayTime,
  type ErrorPage,
  errorRange,
  EVENT_FIELDS,
  type EventPage,
  type Fields,
  type Invitation,
  type Order,
  type PlayerDetail,
  type PlayerStats,
} from './admin-panels.ts';

/** What the panels need from the frame: the calls of the server, the way back to the login and the download of the errors. */
export interface PanelDeps {
  api: (url: string, body?: unknown) => Promise<Record<string, unknown>>;
  signedOut: (error: unknown) => never;
  /** Saves the ZIP of the errors of a time range. */
  download: (body: object) => Promise<void>;
}

let deps: PanelDeps | null = null;

/** Hands the panels the calls of the frame (once, by features/admin.ts). */
export const bindAdminPanel = (given: PanelDeps): void => {
  deps = given;
};

type Call = (route: string, body?: object) => Promise<Record<string, unknown>>;

const call: Call = (route, body = {}) => deps!.api(`/api/admin/${route}`, body);

/** The record of a player: the line of the statistics and the answer of the server. */
interface PlayerRecord {
  person: PlayerStats;
  detail: PlayerDetail;
}

class AdminPanels {
  /** The admin the panels were made for; null while none is shown. */
  user: string | null = null;
  tab = $state<AdminTab>('events');

  // The diagnostics.
  fields = $state.raw<Fields>({ ...EVENT_FIELDS });
  /** The error of the last call of the diagnostics, shown as a note. */
  notice = $state.raw<string | null>(null);
  events = $state.raw<EventPage | null>(null);
  stats = $state.raw<PlayerStats[] | null>(null);
  record = $state.raw<PlayerRecord | null>(null);
  orders = $state.raw<{ orders: Order[]; now: number } | null>(null);

  // The errors.
  errorFields = $state.raw<Fields>({ kind: '', limit: '10' });
  range = $state.raw<Fields>(errorRange(0));
  errorNotice = $state.raw<string | null>(null);
  errors = $state.raw<ErrorPage | null>(null);

  // The invitations: the list, or what the server refused.
  invitations = $state.raw<{ list: Invitation[] } | { error: string } | null>(
    null,
  );
}

export const panels = new AdminPanels();

// What the loaders remember apart from the state: the filter of the shown
// pages of the event log and the newest request of each list.
let query: Record<string, unknown> = {};
let before = 0;
let eventRequest = 0;
let selected = '';
let playerRequest = 0;
let runRequest = 0;
let errorBefore = 0;
let errorRequest = 0;
let invitationRequest = 0;

/** Drops the panels, for a render that is no longer the page „Admin“ of an admin. */
export function forgetAdminPanel(): void {
  panels.user = null;
}

function reset(user: string, now: number): void {
  panels.user = user;
  panels.tab = 'events';
  panels.fields = { ...EVENT_FIELDS };
  panels.notice = null;
  panels.events = panels.stats = panels.record = panels.orders = null;
  panels.errorFields = { kind: '', limit: '10' };
  panels.range = errorRange(now);
  panels.errorNotice = panels.errors = null;
  panels.invitations = null;
  query = {};
  before = errorBefore = 0;
  selected = '';
  // A call still on its way for the admin before must not show its answer.
  eventRequest++;
  playerRequest++;
  runRequest++;
  errorRequest++;
  invitationRequest++;
}

/**
 * The page „Admin“ is mounted for `user`: the panels of the earlier render
 * stay for the same admin, else new ones start on the tab „Ereignisprotokoll“.
 */
export function enterAdminPanels(user: string, now: number): void {
  if (panels.user === user) return;
  reset(user, now);
  openAdminTab('events');
}

// ----- the event log, the player records and the orders -----

/** Loads a page of the event log; only the newest request shows its result. */
async function loadEvents(page?: number, player?: string): Promise<void> {
  const id = ++eventRequest;
  if (player !== undefined) panels.fields = { ...panels.fields, player };
  if (page === undefined) {
    query = dayQuery(panels.fields);
    before = 0;
  }
  const data = (await call('events', {
    ...query,
    page: page ?? 1,
    before,
  })) as unknown as EventPage;
  if (id !== eventRequest) return;
  before = data.before;
  panels.events = data;
}

async function loadPlayers(player = selected): Promise<void> {
  selected = player;
  const id = ++playerRequest;
  const [stats, detail] = await Promise.all([
    call('stats'),
    player ? call('player', { player }) : null,
  ]);
  if (id !== playerRequest) return;
  const people = stats.players as PlayerStats[];
  panels.stats = people;
  const person = people.find((p) => p.id === player);
  panels.record =
    detail && person
      ? { person, detail: detail as unknown as PlayerDetail }
      : null;
}

async function loadOrders(reference = ''): Promise<void> {
  const result = await call('orders', { reference });
  panels.orders = {
    orders: result.orders as Order[],
    now: Number(result.now),
  };
}

/** Runs a call of the diagnostics; a refusal of the newest one is shown as a note. */
async function run(work: () => Promise<void>): Promise<void> {
  const id = ++runRequest;
  panels.notice = null;
  try {
    await work();
  } catch (error) {
    if (id !== runRequest) return;
    panels.notice = (error as Error).message;
  }
}

/** Shows the page of the event log; the buttons of the pager. */
export const eventsPageTo = (page: number): Promise<void> =>
  run(() => loadEvents(page));

/** Reads the event log by the filter, from its first page (the button „Anzeigen“, a change of „Pro Seite“). */
export const showEvents = (): Promise<void> => run(() => loadEvents());

/** The event log of a planet or fleet reference (#151). */
export function filterByReference(reference: string): void {
  panels.fields = { ...panels.fields, reference };
  openAdminTab('events');
}

/** „Mond anlegen“ at a planet of the open record (#53), then the record again. */
export const setMoon = (planet: string, chance: number): Promise<void> =>
  run(async () => {
    await call('moon', { planet, chance });
    await loadPlayers();
  });

/** A moderation of the open record (revoke the sessions, ban, unban), then the record again. */
export const moderate = (values: Record<string, unknown>): Promise<void> =>
  run(async () => {
    await call('moderate', values);
    await loadPlayers();
  });

// ----- the errors -----

async function loadErrors(page?: number): Promise<void> {
  const id = ++errorRequest;
  if (page === undefined) errorBefore = 0;
  let data: ErrorPage;
  try {
    data = (await deps!.api('/api/admin/errors', {
      ...panels.errorFields,
      page: page ?? 1,
      before: errorBefore,
    })) as unknown as ErrorPage;
  } catch (error) {
    // A newer list request owns the note; an old failure stays quiet.
    if (id !== errorRequest) return;
    throw error;
  }
  if (id !== errorRequest) return;
  errorBefore = data.before;
  panels.errors = data;
}

async function runErrors(work: () => Promise<void>): Promise<void> {
  panels.errorNotice = null;
  try {
    await work();
  } catch (error) {
    panels.errorNotice = (error as Error).message;
  }
}

/** Reads the list of the errors by the filter, from its first page. */
export const showErrors = (): Promise<void> => runErrors(() => loadErrors());

/** Shows a page of the errors. */
export const errorsPageTo = (page: number): Promise<void> =>
  runErrors(() => loadErrors(page));

/** The ZIP of the errors of the days typed in (whole days, local time). */
export const downloadErrorRange = (): Promise<void> =>
  runErrors(() =>
    deps!.download({
      since: dayTime(panels.range.since),
      until: dayTime(panels.range.until, true),
    }),
  );

// ----- the invitations -----

/** Loads the list of the invitations again; only the newest request shows its result. */
export async function refreshInvitations(): Promise<void> {
  if (panels.user === null || !deps) return;
  const id = ++invitationRequest;
  try {
    const reply = await deps.api('/api/admin/invitations', {});
    if (id === invitationRequest)
      panels.invitations = { list: reply.invitations as Invitation[] };
  } catch (error) {
    if (id === invitationRequest)
      panels.invitations = { error: (error as Error).message };
  }
}

// ----- the tabs -----

/** Shows the tab and loads what it needs. */
export function openAdminTab(tab: AdminTab, value?: string): void {
  if (panels.user === null) return;
  panels.tab = tab;
  if (diagnosticTab(tab)) {
    void run(() =>
      tab === 'events'
        ? loadEvents(undefined, value)
        : tab === 'players'
          ? loadPlayers(value)
          : loadOrders(value),
    );
  }
  if (tab === 'invitations') void refreshInvitations();
  if (tab === 'errors') void runErrors(() => loadErrors());
}

/** The arrow keys, Home and End move between the tabs (the pattern of a tab list). */
export function adminTabKey(event: KeyboardEvent): void {
  const selectedTab = (event.target as HTMLElement).closest(
    '[role=tab][data-tab]',
  );
  if (!selectedTab) return;
  const tabs = Object.keys(ADMIN_TABS) as AdminTab[];
  const index = tabs.indexOf(panels.tab);
  const moves: Record<string, number> = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    Home: 0,
    End: tabs.length - 1,
  };
  if (!Object.hasOwn(moves, event.key)) return;
  event.preventDefault();
  const tab = tabs[(moves[event.key]! + tabs.length) % tabs.length]!;
  openAdminTab(tab);
  document.querySelector<HTMLElement>(`#admin-tab-${tab}`)?.focus();
}
