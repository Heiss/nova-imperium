// The browser glue: server calls, rendering, events and the clock. The state
// lives in the state module (logic/state.svelte.ts, #118); the views are pure
// functions (views/) or Svelte components; the logic is tested (logic/); this
// file is run by the E2E suite.
import { flushSync } from 'svelte';
import { missionRules } from '../core/missions.ts';
import { placeId } from '../core/place.ts';
import { settle, settleR } from '../core/settle.ts';
import type { Planet } from '../core/types.ts';
import { abandonActs } from './abandon-actions.ts';
import { socialActs } from './social-actions.ts';
import { createAct, placeOf, samePlace } from './logic/act.ts';
import { LEXICANUM_VIEW, viewUrl } from './logic/address.ts';
import { CATALOG_VIEWS, catalogKind, orderNote } from './logic/catalog-list.ts';
import { sameSignIn } from './logic/guild-chat.ts';
import { debrisAt, debrisTip } from './logic/debris.ts';
import * as demolition from './logic/demolition.ts';
import { endzeitNote } from './logic/endzeit.ts';
import { moonAt, moonTarget } from './logic/moon.ts';
import { scanOf } from './logic/phalanx.ts';
import { targetOf } from './logic/galaxy.ts';
import { clampInt, coords, dt, dur, esc, fmt } from './logic/format.ts';
import {
  apiFailure,
  type ClientError,
  createReporter,
  describeError,
  ERRORS_URL,
  failedCall,
  reportFormHTML,
} from './logic/error-report.ts';
import {
  fleetPreview,
  galaxyStep,
  nameOf,
  settingsFrom,
  type FleetForm,
} from './logic/game.ts';
import { headerLine } from './logic/header.ts';
import { highscoreCategory } from './logic/highscore.ts';
import { keeps, viewDue } from './logic/jump-gate.ts';
import { chatToSee, finishedYardOrders } from './logic/menu-hints.ts';
import { gameIsBack, maintenanceNotice } from './logic/maintenance.ts';
import { latestNews, NEWS_SEEN_KEY, type NewsData } from './logic/news.ts';
import { hiddenView, navigation } from './logic/navigation.ts';
import { ANIMATION_KEY, animationsOn } from './logic/planet.ts';
import { pushSaver } from './logic/push-options.ts';
import { client } from './logic/state.svelte.ts';
import { resourceBar } from './logic/resource-bar.ts';
import type { GameState } from './logic/types.ts';
import type { Ui, V } from './views/common.ts';
import { VIEWS } from './views/index.ts';
import {
  clearFrame,
  showHeader,
  showNavigation,
  showResourceBar,
} from './views/frame.ts';
import {
  loadInvitations,
  mountAdminDiagnostics,
} from './views/admin-diagnostics.ts';
import { downloadErrors, mountAdminErrors } from './views/admin-errors.ts';
import {
  ADMIN_TABS,
  auth,
  deleteAccountDialog,
  diagnosticTab,
  endzeitDialog,
  type AdminTab,
} from './views/misc.ts';
import { disablePush, enablePush } from './push.ts';
import { optionActs } from './option-actions.ts';
import { fleetActs } from './fleet-acts.ts';
import { roundActs } from './round-actions.ts';
import { mountCatalogList } from './views/catalog-list.ts';
import { renderGate } from './views/vacation-lock.ts';
import {
  adminChatDialog,
  dissolveDialog,
  transferDialog,
} from './views/guilds.ts';
import { mountGalaxy } from './views/galaxy.ts';
import { lexicanumActions, mountLexicanum } from './views/lexicanum.ts';
import { mountOverview } from './views/overview.ts';
import { mountProducerTable } from './views/producer-table.ts';
import { missileActs } from './views/missiles.ts';
import { addPasskey, signInWithPasskey } from './passkeys.ts';

type Data = Record<string, string | undefined>;

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);
const val = (sel: string): string => $<HTMLInputElement>(sel)?.value ?? '';
/** The value of a field by its id (ids of guild ranks are not CSS-safe). */
const byId = (id: string): string =>
  (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
const setById = (id: string, value: string): void => {
  const field = document.getElementById(id) as HTMLInputElement | null;
  if (field) field.value = value;
};
/** The checked rights of a guild rank (#163), the disabled ones included. */
const rankRights = (rank?: string): string[] =>
  [...document.querySelectorAll<HTMLInputElement>('input[data-rank-right]')]
    .filter((box) => box.dataset.rankRight === rank && box.checked)
    .map((box) => box.value);

let loginChallenge: string | null = null;
let rememberLogin = false;
let resetToken: string | null = null;
/** The views that are Svelte components (#114, #118). */
const MOUNTED = new Set([
  'overview',
  'galaxy',
  'resources',
  LEXICANUM_VIEW,
  ...Object.keys(CATALOG_VIEWS),
]);
/** The Svelte views mounted anew on every render (#118). */
const ANEW = new Set(['overview', 'galaxy']);
/** The mounted Svelte view and its name. */
let mounted: {
  view: string;
  update?: (v: V) => void;
  destroy: () => void;
} | null = null;
let adminPanel: {
  diagnostics: HTMLElement;
  invitations: HTMLElement;
  errors: HTMLElement;
  user: string;
  tab: AdminTab;
  panel: ReturnType<typeof mountAdminDiagnostics>;
  errorPanel: ReturnType<typeof mountAdminErrors>;
} | null = null;
let lastActivity = -Infinity;

interface InstallPrompt extends Event {
  prompt: () => Promise<unknown>;
}
let installPrompt: InstallPrompt | null = null;
let installedHere = false;
const INSTALL_DISMISSED_KEY = 'nova.pwa.install-dismissed';
let installDismissed = readInstallDismissal();

function readNewsSeen(): string | null {
  try {
    return localStorage.getItem(NEWS_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Opening „Neuigkeiten“ clears the dot on this device (issue #81). */
function seeNews(): void {
  const latest = latestNews(ui.news);
  if (!latest || latest === ui.newsSeen) return;
  ui.newsSeen = latest;
  try {
    localStorage.setItem(NEWS_SEEN_KEY, latest);
  } catch {
    // Without storage the dot comes back on the next visit.
  }
}

let newsLoading = false;
/** Counts the reloads of the news; an answer of an older load is dropped. */
let newsLoad = 0;
async function loadNews(): Promise<void> {
  if (ui.news || newsLoading) return;
  newsLoading = true;
  const load = newsLoad;
  try {
    const news = (await api('/api/news')) as unknown as NewsData;
    if (load !== newsLoad) return;
    ui.news = news;
    if (client.game) render();
  } catch (e) {
    console.warn(e);
  } finally {
    newsLoading = false;
  }
}

function readInstallDismissal(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
const mobileInstall = matchMedia('(max-width: 800px) and (pointer: coarse)');
const standalone = matchMedia('(display-mode: standalone)');

function isInstalled(): boolean {
  const platform = navigator as Navigator & { standalone?: boolean };
  return installedHere || standalone.matches || platform.standalone === true;
}

function updateInstallButton(): void {
  const button = $('#pwa-install');
  if (button) button.hidden = !installPrompt || isInstalled();
  const offer = $('#pwa-offer');
  if (offer)
    offer.hidden = !mobileInstall.matches || isInstalled() || installDismissed;
}
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  updateInstallButton();
});
window.addEventListener('appinstalled', () => {
  installedHere = true;
  installPrompt = null;
  updateInstallButton();
});

mobileInstall.addEventListener('change', updateInstallButton);
standalone.addEventListener('change', updateInstallButton);
updateInstallButton();

function gameView(view: string | null): string {
  if (!view || (!MOUNTED.has(view) && !Object.hasOwn(VIEWS, view)))
    return 'overview';
  return hiddenView(view, client.game) ? 'overview' : view;
}

const viewFromUrl = (): string =>
  gameView(new URLSearchParams(location.search).get('view'));

const urlOf = (view: string, guild: string | null = null): string =>
  viewUrl(location.href, view, guild);

const ui: Ui = Object.assign(client.ui, {
  view: viewFromUrl(),
  guild: new URLSearchParams(location.search).get('guild'),
  animations: animationsOn(() => localStorage.getItem(ANIMATION_KEY)),
  newsSeen: readNewsSeen(),
});
document.documentElement.classList.toggle('no-anim', !ui.animations);

/** Planet animations on or off for this viewer (issue #61, D9). */
function setAnimations(on: boolean): void {
  ui.animations = on;
  document.documentElement.classList.toggle('no-anim', !on);
  try {
    localStorage.setItem(ANIMATION_KEY, on ? 'on' : 'off');
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

// ----- maintenance (issue #80) -----

const MAINTENANCE_POLL_MS = 15000;
let maintenance: string | null = null;

/** A banner over the game while the server is in maintenance; checks back. */
function showMaintenance(text: string): void {
  let banner = $('#maintenance');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'maintenance';
    banner.className = 'maintenance';
    banner.setAttribute('role', 'status');
    document.body.prepend(banner);
  }
  banner.textContent = `Wartung – ${text}`;
  if (maintenance === null) setTimeout(checkBack, MAINTENANCE_POLL_MS);
  maintenance = text;
}

async function checkBack(): Promise<void> {
  try {
    const r = await fetch('/healthz', { cache: 'no-store' });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (gameIsBack(r.status, body)) {
      maintenance = null;
      $('#maintenance')?.remove();
      // An update may have brought a new version: load its news again.
      ui.news = null;
      newsLoading = false;
      newsLoad++;
      // Maintenance during the first load left no state: load from scratch.
      void (client.game ? refresh() : boot());
      return;
    }
  } catch {
    // still down
  }
  setTimeout(checkBack, MAINTENANCE_POLL_MS);
}

/** Shows the banner and ends the request when the server is in maintenance. */
function stopOnMaintenance(r: Response, body: Record<string, unknown>): void {
  const notice = maintenanceNotice(
    r.status,
    r.headers.get('nova-maintenance'),
    body,
  );
  if (!notice) return;
  showMaintenance(notice);
  throw new Error(notice);
}

function toast(msg: string, err = false): void {
  // The banner already says it.
  if (msg === maintenance) return;
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.setAttribute('role', err ? 'alert' : 'status');
  t.textContent = msg;
  // Signed-in players can report every error message (issue #126).
  const offer = err && client.game !== null;
  if (offer) t.append(reportOffer(msg));
  document.body.appendChild(t);
  setTimeout(() => t.remove(), offer ? 8000 : 3500);
}

function reportOffer(msg: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'small';
  button.textContent = 'Problem melden';
  Object.assign(button.dataset, {
    act: 'reportProblem',
    message: msg,
    page: ui.view,
    request: ui.lastRequestId ?? '',
  });
  return button;
}

/** The form „Problem melden“ in a dialog, filled from the error message. */
function openReport(d: Data): void {
  modal(
    reportFormHTML('reportform-dialog', {
      source: 'toast',
      page: d.page ?? ui.view,
      version: ui.news?.version ?? '',
      requestId: d.request || null,
      message: d.message,
    }) + '<button type="button" data-act="closeModal">Abbrechen</button>',
  );
  $('#reportform-dialog-text')?.focus();
}

async function submitReport(id: string): Promise<void> {
  const form = $<HTMLFormElement>(`#${id}`);
  if (!form) return;
  try {
    const j = await api('/api/report', Object.fromEntries(new FormData(form)));
    form.reset();
    // Close the dialog only if it is still this one, not one opened since.
    if (id === 'reportform-dialog' && form.isConnected) modal('');
    toast(String(j.msg));
  } catch (e) {
    toast((e as Error).message, true);
  }
}

// ----- error log (issue #126) -----

/** Sends script errors and failed calls; never through api(), so no loop. */
const reportError: (error: ClientError) => void = createReporter({
  send: (body) =>
    fetch(ERRORS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    }),
  context: () => ({
    signedIn: client.game !== null,
    page: ui.view,
    version: ui.news?.version ?? '',
    browser: navigator.userAgent,
  }),
  now: Date.now,
});
window.addEventListener('error', (event) =>
  reportError({
    kind: 'error',
    ...describeError(event.error ?? event.message),
  }),
);
window.addEventListener('unhandledrejection', (event) =>
  reportError({ kind: 'rejection', ...describeError(event.reason) }),
);

function modal(html: string): void {
  const m = $('#modal')!;
  $('#modalIn')!.innerHTML = html;
  m.classList.toggle('show', html !== '');
}

// ----- server -----

class AuthError extends Error {}

/**
 * True until boot() knows what to show. A 401 meanwhile renders nothing:
 * boot() renders the login, or the registration of an invitation link once
 * the server has checked it. The login rendered before would take the
 * player's input, and the registration would replace it empty (#272).
 */
let booting = true;

/** The session is gone (401): back to the login, then stop the caller. */
function signedOut(error: unknown): never {
  client.game = null;
  ui.auth ??= 'login';
  if (!booting) render(true);
  throw new AuthError(String(error ?? 'Bitte einloggen.'));
}

async function api(
  url: string,
  body?: unknown,
  retryBusy = true,
): Promise<Record<string, unknown>> {
  const r = await request(url, body);
  ui.lastRequestId = r.headers.get('x-request-id') ?? ui.lastRequestId;
  const j = (await r
    .json()
    .catch(() => ({ error: 'Keine Antwort vom Server.' }))) as Record<
    string,
    unknown
  >;
  stopOnMaintenance(r, j);
  if (r.status === 401) signedOut(j.error);
  if (isRetryableAction(r, j, retryBusy)) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return api(url, body, false);
  }
  if (!r.ok) {
    if (failedCall(r.status))
      reportError(apiFailure(url, r.status, r.headers.get('x-request-id')));
    throw apiError(r, j.error);
  }
  return j;
}

async function request(url: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (error) {
    reportError(apiFailure(url, null));
    throw error;
  }
}

function isRetryableAction(
  response: Response,
  body: Record<string, unknown>,
  retry: boolean,
): boolean {
  return retry && response.status === 503 && body.code === 'ACTION_DB_BUSY';
}

function apiError(response: Response, error: unknown): Error {
  const id =
    response.status >= 500 ? response.headers.get('x-request-id') : null;
  return new Error(String(error ?? 'Fehler') + (id ? ` Vorgang: ${id}` : ''));
}

function apply(st: GameState | undefined, fresh = false): void {
  if (!st || resetToken) return;
  const key = JSON.stringify({ ...st, now: 0 });
  const same = key === client.lastKey;
  client.lastKey = key;
  if (
    client.game &&
    (st.me.id !== client.game.me.id ||
      st.round.number !== client.game.round.number)
  )
    client.forget();
  client.offset = st.now - Date.now();
  client.game = st;
  void loadNews();
  const view = gameView(ui.view);
  if (view !== ui.view) {
    ui.view = view;
    history.replaceState(null, '', urlOf(view));
  }
  $('#unisub')!.textContent = `Classic Universum · Speed x${st.cfg.speed}`;
  if (!same || fresh) render(fresh);
}

function stateUrl(planet?: string): string {
  return planet
    ? `/api/state?planet=${encodeURIComponent(planet)}`
    : '/api/state';
}

let planetRequest = 0;

async function selectPlanet(id: string): Promise<void> {
  const request = ++planetRequest;
  const player = client.game?.me.id;
  try {
    const state = (await api(stateUrl(id))) as unknown as GameState;
    if (
      request !== planetRequest ||
      !player ||
      client.game?.me.id !== player ||
      state.planet?.id !== id
    )
      return;
    client.forget();
    apply(state, true);
  } catch (e) {
    toast((e as Error).message, true);
  }
}

/** Every game action of the views goes through here (#118). */
const sync = createAct({
  api,
  state: () => client.game,
  apply: (state) => apply(state),
  toast,
  answer: (data) => {
    const scan = scanOf(data);
    if (scan) ui.scan = scan;
  },
});

/** Whether the action went through, wherever the player is now. */
const act = async (type: string, data?: object): Promise<boolean> =>
  (await sync.send(type, data)) !== 'failed';

/**
 * Whether the action went through on the planet still shown, so its form
 * may be cleared; not when the player switched planets meanwhile (#209).
 */
const actHere = async (type: string, data?: object): Promise<boolean> =>
  (await sync.send(type, data)) === 'done';

async function refresh(): Promise<void> {
  const before = placeOf(client.game);
  const planet = before.planet;
  // A refresh that overlaps an action never brings back an older state.
  const fresh = sync.refresh();
  try {
    const state = (await api(
      stateUrl(planet === client.game?.mainPlanet ? undefined : planet),
    )) as unknown as GameState;
    if (fresh() && samePlace(client.game, before)) apply(state);
  } catch (e) {
    if (client.game) console.warn(e);
  }
}

/** The push kinds (#192): one save at a time, the newest choice wins. */
const savePush = pushSaver(ui, (off) => act('pushOptions', { off }));

// ----- rendering -----

/** Sets the planet textures from data-surface/data-clouds (CSSOM is allowed by the CSP, style="" is not). */
function paintPlanets(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-surface]').forEach((el) => {
    const layer = (cls: string, url: string): void => {
      el.querySelector<HTMLElement>(cls)!.style.backgroundImage =
        `url("${url}")`;
    };
    layer('.pl-surface', el.dataset.surface!);
    layer('.pl-clouds', el.dataset.clouds!);
  });
}

function keepInputs(view: HTMLElement, fresh: boolean): () => void {
  const saved: Record<string, string> = {};
  const checked: Record<string, boolean> = {};
  const focus = document.activeElement?.id;
  if (!fresh)
    view
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input[id],select[id],textarea[id]')
      .forEach((i) => {
        if (i.hasAttribute('data-rank-right'))
          checked[i.id] = (i as HTMLInputElement).checked;
        else saved[i.id] = i.value;
      });
  return () => {
    for (const [id, v] of Object.entries(saved)) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.hasAttribute('data-nokeep') && keeps(el, v)) el.value = v;
    }
    // A ticked or cleared box of a guild rank survives the refresh (#163);
    // a disabled one shows the server's state, it is no draft.
    for (const [id, on] of Object.entries(checked)) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.disabled) el.checked = on;
    }
    if (focus) document.getElementById(focus)?.focus();
  };
}

function renderLoggedOut(view: HTMLElement): void {
  client.forget();
  unmountViews();
  clearFrame();
  view.innerHTML = ui.auth ? auth(ui) : '<div class="notice">Lade …</div>';
}

function rememberCompletions(previous: V, next: V): void {
  if (previous.P.id !== next.P.id) return;
  demolition.rememberUpgrade(
    client,
    previous.P.bq,
    next.P.b,
    'buildings',
    'Ausbau fertig',
    next.now,
  );
  demolition.rememberUpgrade(
    client,
    previous.R.rq,
    next.R.research,
    'research',
    'Forschung fertig',
    next.now,
  );
  for (const view of finishedYardOrders(previous.P, next.now)) {
    client.completedMenu.set(view, 'Auftrag der Schiffsschmiede fertig');
    client.completionNotices.add('Auftrag der Schiffsschmiede fertig.');
  }
  rememberFleetReturn(previous, next);
}

function rememberFleetReturn(previous: V, next: V): void {
  const live = new Set(next.s.fleets.map((fleet) => fleet.id));
  if (
    previous.s.fleets.some(
      (fleet) =>
        fleet.owner === next.s.me.id &&
        fleet.state === 'back' &&
        fleet.ret !== undefined &&
        fleet.ret <= next.now &&
        !live.has(fleet.id),
    )
  )
    client.completedMenu.set('fleet', 'Die Flotte kehrt heim');
}

function renderCompletions(view: HTMLElement): void {
  view.querySelector('#completion-notice')?.remove();
  if (!client.completionNotices.size) return;
  const notice = document.createElement('div');
  notice.id = 'completion-notice';
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  notice.textContent = [...client.completionNotices].join(' ');
  view.prepend(notice);
}

/** Unmounts the Svelte view (the lists, the resources). */
function unmountViews(): void {
  mounted?.destroy();
  mounted = null;
}

/** Whether a list is mounted: it shows the clock's view state (#118). */
const listMounted = (): boolean => !!mounted && !!catalogKind(mounted.view);

/** Mounts the Svelte component of the view; any other view gets the overview. */
function mountView(target: HTMLElement, view: V): NonNullable<typeof mounted> {
  const kind = catalogKind(ui.view);
  if (kind) return { view: ui.view, ...mountCatalogList(target, kind) };
  if (ui.view === 'resources')
    return { view: ui.view, ...mountProducerTable(target, view) };
  if (ui.view === 'galaxy')
    return { view: ui.view, ...mountGalaxy(target, view) };
  if (ui.view === LEXICANUM_VIEW)
    return { view: ui.view, ...mountLexicanum(target) };
  return { view: 'overview', ...mountOverview(target) };
}

/**
 * Mounts the view of a Svelte component, or updates the mounted one. A
 * fresh render mounts a list again, as the HTML views render anew: no
 * number typed into the shipyard stays on another planet. The overview and
 * the Sternenkarte are mounted anew on every render, as their HTML views
 * were rendered (#118): the clock counts their countdowns down and marks
 * the ones that fired.
 */
function renderMounted(target: HTMLElement, view: V, fresh: boolean): void {
  const kind = catalogKind(ui.view);
  client.shown = view;
  if (mounted?.view === ui.view && !ANEW.has(ui.view) && !(fresh && kind)) {
    mounted.update?.(view);
    return flushSync();
  }
  unmountViews();
  target.replaceChildren();
  mounted = mountView(target, view);
  flushSync();
}

function renderView(target: HTMLElement, view: V, fresh: boolean): void {
  if (ui.view !== 'admin' || !view.s.me.admin) adminPanel = null;
  const show = Object.entries(VIEWS).find(([name]) => name === ui.view)?.[1];
  if (MOUNTED.has(ui.view) || !show) return renderMounted(target, view, fresh);
  unmountViews();
  target.innerHTML = show(view);
  if (ui.view === 'admin' && view.s.me.admin) renderAdminPanel(target, view);
}

function renderAdminPanel(target: HTMLElement, view: V): void {
  const diagnostics = target.querySelector<HTMLElement>('#admin-diagnostics')!;
  const invitations = target.querySelector<HTMLElement>('#admin-invitations')!;
  const errors = target.querySelector<HTMLElement>('#admin-errors')!;
  if (adminPanel?.user === view.s.me.id) {
    diagnostics.replaceWith(adminPanel.diagnostics);
    invitations.replaceWith(adminPanel.invitations);
    errors.replaceWith(adminPanel.errors);
    paintAdminTab(adminPanel.tab);
    return;
  }
  const panel = mountAdminDiagnostics(
    diagnostics,
    api,
    view.s.players,
    openAdminTab,
  );
  adminPanel = {
    diagnostics,
    invitations,
    errors,
    user: view.s.me.id,
    tab: 'events',
    panel,
    errorPanel: mountAdminErrors(
      errors,
      api,
      (body) => downloadErrors(body, signedOut),
      Date.now(),
    ),
  };
  openAdminTab('events');
}

function paintAdminTab(tab: AdminTab): void {
  const selected = diagnosticTab(tab) ? 'diagnostics' : tab;
  const panel = $(`#admin-panel-${selected}`)!;
  for (const item of document.querySelectorAll<HTMLElement>(
    '#view [role=tabpanel]',
  ))
    item.hidden = item !== panel;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '#view [role=tab]',
  )) {
    const active = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  panel.setAttribute('aria-labelledby', `admin-tab-${tab}`);
}

function openAdminTab(tab: AdminTab, value?: string): void {
  if (!adminPanel) return;
  adminPanel.tab = tab;
  paintAdminTab(tab);
  if (diagnosticTab(tab)) void adminPanel.panel.open(tab, value);
  if (tab === 'invitations') refreshInvitations();
  if (tab === 'errors') void adminPanel.errorPanel.open();
}

function refreshInvitations(): void {
  if (adminPanel) void loadInvitations(adminPanel.invitations, api);
}

/** The view state moved to now. */
function viewAt(state: GameState, planet: Planet, now: number): V {
  const here = settle(planet, now, state.cfg, state.me);
  return { s: state, P: here, R: settleR(state.me, now), now, ui };
}

function render(fresh = false): void {
  const view = $('#view')!;
  if (!client.game) {
    adminPanel = null;
    lastActivity = -Infinity;
    return renderLoggedOut(view);
  }
  if (renderGate(view, client.game, ui, unmountViews)) return;
  const restore = keepInputs(view, fresh);
  const chatScroll = keepChatScroll(view);
  const now = client.now();
  const previous = client.view;
  client.view = viewAt(client.game, client.game.planet!, now);
  if (previous && !fresh) rememberCompletions(previous, client.view);
  renderMenu();
  updateBar();
  showHeader(headerLine(client.game, client.view.P));
  renderView(view, client.view, fresh);
  if (ui.view === 'help') updateInstallButton();
  renderCompletions(view);
  paintPlanets(view);
  restore();
  chatScroll();
  if (ui.view === 'fleet') fleetCalc();
  if (ui.view === 'achievements') filterAchievements();
  if (ui.view === 'messages') markRead();
  seeChat();
}

function filterAchievements(): void {
  const query = val('#achievement_search').trim().toLocaleLowerCase('de');
  const category = val('#achievement_category');
  const status = val('#achievement_status');
  document
    .querySelectorAll<HTMLElement>('[data-achievement]')
    .forEach((item) => {
      item.hidden =
        (!!category && item.dataset.category !== category) ||
        (!!status && item.dataset.status !== status) ||
        !item.dataset.search!.includes(query);
    });
  document
    .querySelectorAll<HTMLElement>('[data-achievement-group]')
    .forEach((group) => {
      group.hidden =
        !!group.querySelector('[data-achievement]') &&
        !group.querySelector('[data-achievement]:not([hidden])');
    });
}

function renderMenu(): void {
  if (ui.view === 'news') seeNews();
  showNavigation(
    navigation(client.game!, ui, client.completedMenu, (view) => urlOf(view)),
  );
}

/** Shows the resource bar of the planet moved to now, and returns that planet. */
function updateBar(): Planet | undefined {
  const game = client.game;
  if (!game?.planet) return;
  const bar = resourceBar(game, game.planet, client.now());
  showResourceBar(bar);
  return bar.planet;
}

let readPending = false;
function markRead(): void {
  const list = client.game!.reports;
  const newest = Math.max(0, ...list.map((r) => r.time));
  if (newest > (client.game!.me.readAt || 0) && !readPending) {
    readPending = true;
    setTimeout(
      () => void act('read').finally(() => (readPending = false)),
      600,
    );
  }
}

let seePending = false;
/** The member saw the chat of its guild: the mark on „Gilden“ goes (#169). */
function seeChat(): void {
  const id = chatToSee(client.game!, ui.view, ui.guild ?? null);
  if (id === null || seePending) return;
  seePending = true;
  const done = (): void => void (seePending = false);
  setTimeout(() => {
    void sync.quiet('seeGuildChat', { id }).finally(done);
  }, 600);
}

// ----- fleet form -----
/** The shown planet with its stock of this moment, for the cargo buttons. */
const settledPlanet = (): Planet =>
  settle(client.game!.planet!, client.now(), client.game!.cfg, client.game!.me);

function readFleetForm(): FleetForm {
  const ships: Record<string, number> = {};
  const P = client.view!.P;
  const u = client.game!.cfg;
  document.querySelectorAll<HTMLInputElement>('.fs').forEach((i) => {
    const k = i.dataset.k!;
    const n = clampInt(i.value, 0, P.ships[k] ?? 0);
    if (n > 0) ships[k] = n;
  });
  return {
    ships,
    to: {
      g: clampInt(val('#t_g'), 1, u.galaxies),
      s: clampInt(val('#t_s'), 1, u.systems),
      p: clampInt(val('#t_p'), 1, u.positions),
      // The planet or its moon (#53).
      kind: val('#t_k') === 'moon' ? 'moon' : 'planet',
    },
    mission: val('#t_m'),
    pct: clampInt(val('#t_v'), 1, 10),
    cargo: {
      m: clampInt(val('#c_m'), 0, 1e15),
      c: clampInt(val('#c_c'), 0, 1e15),
      d: clampInt(val('#c_d'), 0, 1e15),
    },
  };
}

/**
 * Beside the target: its planet and owner, a free position, or none; for a
 * Bergung the Trümmerfeld there, or none (#45).
 */
function targetInfo(s: GameState, f: FleetForm): string {
  if (missionRules(f.mission)?.target === 'debris') {
    const field = debrisAt(s.debris, f.to);
    return field
      ? debrisTip(field)
      : '<span class="bad">kein Trümmerfeld</span>';
  }
  if (f.to.kind === 'moon')
    return moonTarget(moonAt(s.galaxy, f.to), (id) => nameOf(s.players, id));
  const target = s.galaxy.find(
    (p) => p.id === placeId({ ...f.to, kind: 'planet' }),
  );
  if (target)
    return `${esc(target.name)} (${esc(nameOf(s.players, target.owner))})`;
  return missionRules(f.mission)?.target === 'free'
    ? 'Freie Position'
    : '<span class="bad">kein Planet</span>';
}

/** The return time, or none for a mission that stays at its target (deploy, #129). */
const returnAt = (mission: string, t: number): string =>
  missionRules(mission)?.returns === false ? '–' : dt(t);

/** „Mond“ in the select of the target only where a moon is (#53). */
function moonOption(s: GameState): void {
  const select = $('#t_k') as HTMLSelectElement | null;
  if (!select) return;
  const to = readFleetForm().to;
  const option = select.querySelector<HTMLOptionElement>('option[value=moon]')!;
  option.disabled = !moonAt(s.galaxy, to);
  if (option.disabled && select.value === 'moon') select.value = 'planet';
}

function fleetCalc(): void {
  if (!$('#t_g') || !client.view || !client.game) return;
  moonOption(client.game);
  const f = readFleetForm();
  $('#t_info')!.innerHTML = targetInfo(client.game, f);
  const pv = fleetPreview(client.view.P, client.view.R, f, client.game.cfg);
  const set = (id: string, html: string): void =>
    void ($(`#${id}`)!.innerHTML = html);
  if (!pv)
    return ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].forEach((id) =>
      set(id, '-'),
    );
  const now = client.now();
  set('i_dist', fmt(pv.dist));
  set('i_dur', dur(pv.ms));
  set('i_arr', `${dt(now + pv.ms)} / ${returnAt(f.mission, now + 2 * pv.ms)}`);
  set(
    'i_fuel',
    `<span class="${pv.fuelShort ? 'bad' : ''}">${fmt(pv.fuel)}</span> Promethium`,
  );
  set(
    'i_cap',
    `<span class="${pv.overload ? 'bad' : ''}">${fmt(pv.load)}</span> / ${fmt(pv.cap)}`,
  );
}

const setInput = (sel: string, v: string | number): void => {
  const el = $<HTMLInputElement>(sel);
  if (el) el.value = String(v);
};

// ----- actions -----

const go = (
  requested: string,
  push = true,
  guild: string | null = null,
): void => {
  const view = gameView(requested);
  if (view !== ui.view || guild !== ui.guild) {
    client.completionNotices.clear();
    if (push) history.pushState(null, '', urlOf(view, guild));
  }
  client.completedMenu.delete(view);
  closeMore();
  ui.view = view;
  ui.guild = view === 'guilds' ? guild : null;
  render(true);
  window.scrollTo(0, 0);
};

async function togglePush(enabled: boolean): Promise<void> {
  try {
    await (enabled ? enablePush : disablePush)(api);
    toast(
      enabled
        ? 'Benachrichtigungen aktiviert.'
        : 'Benachrichtigungen deaktiviert.',
    );
  } catch (e) {
    toast((e as Error).message, true);
  }
}

function closeMore(): void {
  const more = $<HTMLDialogElement>('#more');
  if (more?.open) more.close();
}

const ACT: Record<string, (d: Data) => unknown> = {
  moreOpen: () => $<HTMLDialogElement>('#more')!.showModal(),
  pushEnable: () => togglePush(true),
  pushDisable: () => togglePush(false),
  guildView: (d) => go('guilds', true, d.id ?? null),
  guildApply: (d) => act('applyToGuild', { id: d.id }),
  guildLeave: (d) => {
    if (!d.confirm || window.confirm(d.confirm)) return act('leaveGuild');
  },
  guildReview: (d) =>
    act('reviewGuildApplication', { uid: d.uid, accept: d.accept === '1' }),
  guildMember: (d) => {
    const ranks = client.game?.guilds?.ranks;
    if (d.transfer === '1' && ranks) {
      const name = client
        .game!.guilds!.directory.flatMap((g) => g.members)
        .find((m) => m.id === d.uid)?.name;
      modal(transferDialog(ranks, d.uid ?? '', name ?? ''));
      return $('#transfer_rank')?.focus();
    }
    if (window.confirm('Mitglied entfernen?'))
      return act('manageGuildMember', { uid: d.uid, transfer: false });
  },
  guildDissolve: (d) => {
    const guild = client.game?.guilds?.directory.find((g) => g.id === d.id);
    if (!guild) return;
    modal(dissolveDialog(guild));
    $('#dissolve_tag')?.focus();
  },
  guildAssign: (d) =>
    act('assignGuildRank', { uid: d.uid, rank: byId(`rank_of_${d.uid}`) }),
  rankCreate: async () => {
    if (await act('createGuildRank', { name: byId('rank_new') }))
      setById('rank_new', '');
  },
  rankRename: (d) =>
    act('renameGuildRank', {
      rank: d.rank,
      name: byId(`rank_name_${d.rank}`),
    }),
  rankRights: (d) =>
    act('setGuildRankRights', { rank: d.rank, rights: rankRights(d.rank) }),
  rankMove: (d) => act('moveGuildRank', { rank: d.rank, up: d.up === '1' }),
  rankDelete: (d) => {
    if (
      window.confirm(
        'Rang löschen? Seine Mitglieder bekommen den Standardrang.',
      )
    )
      return act('deleteGuildRank', { rank: d.rank });
  },
  rankDefault: (d) => act('setGuildDefaultRank', { rank: d.rank }),
  guildChatAdmin: (d) => openAdminChat(d.id ?? ''),
  achievementClaim: (d) => act('claimAchievement', { id: d.id }),
  dailyClaim: () => act('claimDailyReward'),
  logout: async () => {
    await disablePush(api).catch(() => null);
    await api('/api/logout', {}).catch(() => null);
    client.game = null;
    ui.auth = 'login';
    render(true);
  },
  forgot: () => {
    ui.auth = 'forgot';
    render(true);
  },
  authback: () => {
    loginChallenge = null;
    resetToken = null;
    ui.auth = 'login';
    render(true);
  },
  authswitch: () => {
    ui.auth = ui.auth === 'register' ? 'login' : 'register';
    render(true);
  },
  build: (d) => act('build', { key: d.k }),
  cancelBuild: () => act('cancelBuild'),
  ...demolition.demolitionActs({ act, modal, view: () => client.view }),
  research: (d) => act('research', { key: d.k }),
  cancelResearch: () => act('cancelResearch'),
  maxq: (d) => setInput(`#q_${d.k}`, d.max ?? 0),
  order: async (d) => {
    const n = clampInt(val(`#q_${d.k}`), 0, 1e9);
    const note = orderNote(client.view!, d.k!, n);
    if (note) return toast(note, true);
    if (await actHere('order', { key: d.k, n })) setInput(`#q_${d.k}`, '');
  },
  rename: () =>
    modal(
      `<p><b>${client.view!.P.kind === 'moon' ? 'Mond' : 'Planet'} umbenennen</b></p><input id="rn" maxlength="20" value="${esc(client.view!.P.name)}" aria-label="Neuer Name"> <button data-act="doRename">OK</button> <button data-act="closeModal">Abbrechen</button>`,
    ),
  doRename: () => {
    const n = val('#rn').trim();
    modal('');
    if (n) void act('rename', { name: n });
  },
  closeModal: () => modal(''),
  gnav: (d) => {
    Object.assign(ui, galaxyStep(ui.gal, ui.sys, d.d ?? '', client.game!.cfg));
    render(true);
  },
  ggo: () => {
    ui.gal = clampInt(val('#g_g'), 1, client.game!.cfg.galaxies);
    ui.sys = clampInt(val('#g_s'), 1, client.game!.cfg.systems);
    render(true);
  },
  selectPlanet: (d) => {
    if (d.id) return selectPlanet(d.id);
  },
  ghome: () => {
    const home =
      client.game!.galaxy.find((p) => p.id === client.game!.mainPlanet) ??
      client.view!.P;
    ui.gal = home.g;
    ui.sys = home.s;
    render(true);
  },
  gto: (d) => {
    ui.gal = Number(d.g);
    ui.sys = Number(d.s);
    go('galaxy');
  },
  gmoon: (d) => {
    ui.gmoon = ui.gmoon === d.id ? null : (d.id ?? null);
    render(true);
  },
  gscan: async (d) => {
    if (!(await actHere('scan', { target: d.id }))) return;
    render(true);
    $('#scan-h')?.focus();
  },
  ...missileActs(modal, actHere),
  gscanClose: () => {
    const target = ui.scan?.target;
    ui.scan = null;
    render(true);
    // The focus goes back to the scan of the planet, while it is shown.
    if (target) $(`[data-act=gscan][data-id="${CSS.escape(target)}"]`)?.focus();
  },
  gfleet: (d) => {
    ui.ft = targetOf(d);
    ui.fm = d.m ?? 'attack';
    go('fleet');
  },
  gspy: (d) => {
    const n = Math.min(
      client.view!.P.ships.probe ?? 0,
      client.game!.me.probes || 1,
    );
    if (!n) return toast('Keine Spähschädel auf dem Planeten.', true);
    return act('send', {
      ships: { probe: n },
      to: targetOf(d),
      mission: d.m ?? 'spy',
      pct: 10,
      cargo: { m: 0, c: 0, d: 0 },
    });
  },
  fmax: (d) => {
    setInput(`#f_${d.k}`, client.view!.P.ships[d.k!] ?? 0);
    fleetCalc();
  },
  ...fleetActs({
    actHere,
    calc: fleetCalc,
    form: readFleetForm,
    planet: settledPlanet,
    setInput,
    render,
  }),
  send: async () => {
    if (await actHere('send', readFleetForm())) {
      ui.ft = null;
      render(true);
    }
  },
  recall: (d) => act('recall', { id: d.id }),
  toggleRep: (d) => {
    ui.openRep[d.id!] = !ui.openRep[d.id!];
    document.getElementById(`rep_${d.id}`)?.classList.toggle('open');
  },
  delrep: (d) => act('delrep', { id: d.id }),
  delall: () => act('delall'),
  // nav, explain and the links of the Lexicanum (#285).
  ...lexicanumActions(go),
  highscore: (d) => {
    ui.highscore = highscoreCategory(d.cat);
    render();
  },
  adminTab: (d) => {
    if (d.tab && Object.hasOwn(ADMIN_TABS, d.tab))
      openAdminTab(d.tab as AdminTab);
  },
  listPasskeys: showPasskeys,
  reportProblem: openReport,
  passkeyLogin: loginByPasskey,
  removePasskey: async (d) => {
    if (!window.confirm('Diesen Passkey entfernen?')) return;
    try {
      await api('/api/passkeys/remove', { id: d.id });
      await showPasskeys();
    } catch (error) {
      toast((error as Error).message, true);
    }
  },
  deleteAccount: () => modal(deleteAccountDialog(client.game!.round)),
  ...optionActs({ act }),
  ...abandonActs({ act, modal }),
  ...socialActs({ act }),
  dismissInstall: () => {
    installDismissed = true;
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      // The offer still stays hidden in this tab when storage is unavailable.
    }
    updateInstallButton();
  },
  installApp: async () => {
    const prompt = installPrompt;
    if (!prompt) {
      modal(
        '<p>Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.</p><p>Auf iPhone und iPad in Safari: „Teilen“ → „Zum Home-Bildschirm“ → „Als Web-App öffnen“.</p><p>Zum Spielen brauchst du eine Internetverbindung.</p><button type="button" data-act="closeModal">Schließen</button>',
      );
      return;
    }
    installPrompt = null;
    updateInstallButton();
    try {
      await prompt.prompt();
    } catch {
      toast('Bitte installiere die App über das Browsermenü.', true);
    }
  },
  ...roundActs({ act, modal }),
  endzeit: () => modal(endzeitDialog(client.game!.admin!.endzeit.minutes)),
  doEndzeit: () => {
    const minutes = val('#endzeit-minutes');
    // The check of the server (F15, #214): a refusal without a request.
    const note = endzeitNote(client.game!.admin!.endzeit.done, minutes);
    modal('');
    return note ? toast(note, true) : act('endzeit', { minutes });
  },
  saveSettings: () => {
    const keys = client.game!.admin!.specs.map((x) => x.key);
    return act('settings', {
      settings: settingsFrom(keys, (k) => val(`#set_${k}`)),
    });
  },
  revoke: async (d) => {
    if (await adminCall('/api/admin/revoke', { id: d.id }))
      refreshInvitations();
  },
  copyLink: async () => {
    const input = $<HTMLInputElement>('#inv_link');
    if (!input) return;
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      toast('Link kopiert.');
    } catch {
      toast('Bitte den markierten Link selbst kopieren.', true);
    }
  },
};

async function adminCall(
  url: string,
  body: object,
): Promise<Record<string, unknown> | null> {
  try {
    const j = await api(url, body);
    apply(j.state as GameState);
    if (j.msg) toast(String(j.msg), j.mailed === false);
    return j;
  } catch (e) {
    toast((e as Error).message, true);
    return null;
  }
}

// ----- forms -----

function continueLogin(reply: Record<string, unknown>): boolean {
  if (!reply.loginRequired && typeof reply.challenge !== 'string') return false;
  loginChallenge = typeof reply.challenge === 'string' ? reply.challenge : null;
  ui.auth = loginChallenge ? 'code' : 'login';
  ui.invite = null;
  render(true);
  if (reply.loginRequired) toast('Konto erstellt. Melde dich jetzt an.');
  return true;
}

async function submitAuth(): Promise<void> {
  const reg = ui.auth === 'register' && ui.invite;
  rememberLogin = Boolean($<HTMLInputElement>('#remember-login')?.checked);
  const body: Record<string, unknown> = {
    name: val('#a_name'),
    password: val('#a_pw'),
    remember: rememberLogin,
  };
  if (reg)
    Object.assign(body, {
      token: ui.invite!.token,
      planet: val('#a_planet'),
      gal: val('#a_gal'),
    });
  try {
    const j = await api(reg ? '/api/register' : '/api/login', body);
    if (continueLogin(j)) return;
    ui.auth = null;
    ui.invite = null;
    apply(j.state as GameState);
    homeSystem();
    if (reg && client.game?.planet)
      toast(
        `Willkommen, ${client.game.me.name}! Dein Planet liegt bei ${coords(client.game.planet)}.`,
      );
    render(true);
  } catch (e) {
    toast((e as Error).message, true);
  }
}

async function loginByPasskey(): Promise<void> {
  try {
    const j = await signInWithPasskey(
      api,
      Boolean($<HTMLInputElement>('#remember-login')?.checked),
    );
    ui.auth = null;
    apply(j.state as GameState);
    homeSystem();
    render(true);
  } catch (error) {
    toast((error as Error).message, true);
  }
}

async function submitPasskey(): Promise<void> {
  try {
    await addPasskey(api, val('#passkey-password'));
    setInput('#passkey-password', '');
    toast('Passkey gespeichert.');
    await showPasskeys();
  } catch (error) {
    toast((error as Error).message, true);
  }
}

async function showPasskeys(): Promise<void> {
  try {
    const j = await api('/api/passkeys/list', {});
    const keys = j.keys as { id: string; created: number }[];
    const list = $('#passkey-list');
    if (!list) return;
    list.innerHTML = keys.length
      ? '<ul>' +
        keys
          .map(
            (key) =>
              `<li>Erstellt am ${dt(key.created)} <button type="button" data-act="removePasskey" data-id="${esc(key.id)}">Entfernen</button></li>`,
          )
          .join('') +
        '</ul>'
      : '<p>Keine Passkeys gespeichert.</p>';
  } catch (error) {
    toast((error as Error).message, true);
  }
}

async function submitLoginCode(): Promise<void> {
  try {
    const j = await api('/api/login/code', {
      challenge: loginChallenge,
      code: val('#login_code'),
      remember: rememberLogin,
    });
    loginChallenge = null;
    ui.auth = null;
    apply(j.state as GameState);
    homeSystem();
    render(true);
  } catch (e) {
    toast((e as Error).message, true);
  }
}

async function submitForgot(): Promise<void> {
  try {
    await api('/api/password/forgot', { email: val('#recovery_email') });
    ui.auth = 'login';
    render(true);
    toast(
      'Falls die Adresse hinterlegt ist, erhältst du einen Link per E-Mail.',
    );
  } catch (e) {
    toast((e as Error).message, true);
  }
}

async function submitPassword(reset: boolean): Promise<void> {
  const password = val('#pw_next');
  const confirmation = val('#pw_confirm');
  if (!reset && password !== confirmation) {
    toast('Die neuen Passwörter stimmen nicht überein.', true);
    $('#pw_confirm')?.focus();
    return;
  }
  try {
    await api(reset ? '/api/password/reset' : '/api/password/change', {
      password,
      ...(reset
        ? { token: resetToken }
        : { current: val('#pw_current'), confirmation }),
    });
    client.game = null;
    resetToken = null;
    ui.auth = 'login';
    render(true);
    toast('Passwort gespeichert. Melde dich mit deinem neuen Passwort an.');
  } catch (e) {
    toast((e as Error).message, true);
  }
}

async function submitAccountDeletion(): Promise<void> {
  const button = $<HTMLButtonElement>(
    '#deleteaccountform button[type=submit]',
  )!;
  if (button.disabled) return;
  button.disabled = true;
  try {
    await api('/api/account/delete', {
      password: val('#delete-account-password'),
    });
    await disablePush(async () => ({})).catch(() => null);
    modal('');
    client.game = null;
    ui.auth = 'login';
    render(true);
    toast('Dein Account wurde gelöscht.');
  } catch (error) {
    toast((error as Error).message, true);
    button.disabled = false;
  }
}

async function submitTransfer(): Promise<void> {
  const ok = await act('manageGuildMember', {
    uid: $('#guildtransferform')?.dataset.uid,
    transfer: true,
    rank: val('#transfer_rank'),
  });
  if (ok) modal('');
}

async function submitDissolve(): Promise<void> {
  if (await act('dissolveGuild', { tag: val('#dissolve_tag') })) {
    modal('');
    go('guilds');
  }
}

/**
 * The admin opens the chat of a guild; the server records it (#169, D8). An
 * answer that comes in after a logout, or with another account signed in,
 * opens nothing (CodeRabbit on #216).
 */
async function openAdminChat(guild: string): Promise<void> {
  const admin = client.game?.me.id;
  try {
    const read = await api('/api/admin/guild-chat', { guild });
    if (!sameSignIn(client.game, admin)) return;
    modal(
      adminChatDialog(read as unknown as Parameters<typeof adminChatDialog>[0]),
    );
    keepChatScroll($('#modalIn')!, true)();
  } catch (error) {
    toast((error as Error).message, true);
  }
}

/**
 * The chat log keeps its place when the view renders again; at its end it
 * follows the new messages (#169).
 */
function keepChatScroll(root: ParentNode, end = false): () => void {
  const log = root.querySelector<HTMLElement>('.chat-log');
  const atEnd =
    end || !log || log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
  const top = log?.scrollTop ?? 0;
  return () => {
    const next = root.querySelector<HTMLElement>('.chat-log');
    if (next) next.scrollTop = atEnd ? next.scrollHeight : top;
  };
}

async function submitGuild(): Promise<void> {
  const edit = $('#guildform')?.dataset.edit === '1';
  const ok = await act(edit ? 'updateGuild' : 'createGuild', {
    tag: val('#guild_tag'),
    name: val('#guild_name'),
    description: val('#guild_description'),
  });
  if (ok && !edit) go('guilds', true, client.game?.guilds?.own?.id ?? null);
}

async function submitInvite(): Promise<void> {
  const email = val('#inv_email').trim();
  const j = await adminCall('/api/admin/invite', { email });
  if (!j) return;
  ui.lastLink = String(j.link);
  render(true);
  refreshInvitations();
}

let announcementPending = false;
async function submitAnnouncement(): Promise<void> {
  if (
    announcementPending ||
    !window.confirm('Servernachricht an alle Spieler senden?')
  )
    return;
  announcementPending = true;
  try {
    const result = await api('/api/admin/announce', {
      message: val('#announce-text'),
    });
    setInput('#announce-text', '');
    toast(
      `Servernachricht für ${Number(result.recipients)} Spieler veröffentlicht.`,
    );
  } catch (error) {
    toast((error as Error).message, true);
  } finally {
    announcementPending = false;
  }
}

function homeSystem(): void {
  if (client.game?.planet) {
    ui.gal = client.game.planet.g;
    ui.sys = client.game.planet.s;
  }
}

// ----- events -----

function noteActivity(event: Event): void {
  if (
    !client.game ||
    !event.isTrusted ||
    document.visibilityState !== 'visible'
  )
    return;
  const now = performance.now();
  if (now - lastActivity < 10000) return;
  lastActivity = now;
  // An activity sample must not change the session UI or block the interaction.
  void fetch('/api/activity', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    credentials: 'same-origin',
  }).catch(() => undefined);
}

document.addEventListener('click', noteActivity, { capture: true });
document.addEventListener('keydown', noteActivity, { capture: true });

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  const fn = el ? ACT[el.dataset.act!] : undefined;
  if (!el || !fn) return;
  const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
  if (el instanceof HTMLAnchorElement && (modified || e.button !== 0)) return;
  e.preventDefault();
  void fn({ ...el.dataset });
});
document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.id === 'planet_select') void selectPlanet(el.value);
  if (el.id === 'o_anim')
    setAnimations((el as unknown as HTMLInputElement).checked);
  if (el.dataset?.chg === 'pct')
    void act('pct', { key: el.dataset.k, v: el.value });
  if (el.dataset?.chg === 'push' && client.game)
    void savePush(
      client.game.me.pushOff,
      el.dataset.k,
      (el as unknown as HTMLInputElement).checked,
    ).then(() => render());
  if (ui.view === 'fleet') fleetCalc();
  if (ui.view === 'achievements') filterAchievements();
});
document.addEventListener('input', (e) => {
  if (
    ui.view === 'achievements' &&
    (e.target as HTMLElement).id === 'achievement_search'
  )
    filterAchievements();
  if (ui.view === 'fleet' && (e.target as HTMLElement).closest('main'))
    fleetCalc();
});
function adminTabKey(event: KeyboardEvent): void {
  const selected = (event.target as HTMLElement).closest(
    '[role=tab][data-tab]',
  );
  if (!selected) return;
  const tabs = Object.keys(ADMIN_TABS) as AdminTab[];
  const index = tabs.indexOf(adminPanel?.tab ?? 'events');
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
  $(`#admin-tab-${tab}`)?.focus();
}
document.addEventListener('keydown', adminTabKey);
document.addEventListener('keydown', (e) => {
  const id = (e.target as HTMLElement).id;
  if (e.key === 'Enter' && id?.startsWith('g_')) ACT.ggo!({});
  if (e.key === 'Escape') modal('');
});
document.addEventListener('submit', (e) => {
  const id = (e.target as HTMLElement).id;
  const handlers = [
    ['authform', submitAuth],
    ['inviteform', submitInvite],
    ['announceform', submitAnnouncement],
    ['guildform', submitGuild],
    ['guildtransferform', submitTransfer],
    ['guilddissolveform', submitDissolve],
    ['codeform', submitLoginCode],
    ['forgotform', submitForgot],
    ['resetform', () => submitPassword(true)],
    ['passwordform', () => submitPassword(false)],
    ['passkeyform', submitPasskey],
    ['deleteaccountform', submitAccountDeletion],
    ['reportform', () => submitReport('reportform')],
    ['reportform-dialog', () => submitReport('reportform-dialog')],
  ] as const;
  const handle = handlers.find(([form]) => form === id)?.[1];
  if (!handle) return;
  e.preventDefault();
  void handle();
});
// The „Mehr“ sheet closes on a tap beside it (on the backdrop).
$('#more')!.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeMore();
});
$('#modal')!.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'modal') modal('');
});

// ----- clock -----

setInterval(() => {
  if (!client.view) return;
  const now = client.now();
  if (viewDue(client.view, now)) {
    render();
    void refresh();
    return;
  }
  let due = false;
  // A list counts its own countdowns down (#118).
  const list = listMounted();
  document
    .querySelectorAll<HTMLElement>(list ? '.cd:not(#view *)' : '.cd')
    .forEach((el) => {
      const left = Number(el.dataset.end) - now;
      if (left > 0) return void (el.textContent = dur(left));
      if (!el.dataset.fired) {
        el.dataset.fired = '1';
        due = true;
      }
      el.textContent = 'fertig';
    });
  const planet = updateBar();
  // The list shows the planet moved to now: costs, buttons, maxima, countdowns.
  if (planet && list) client.shown = { ...client.view, P: planet, now };
  if (due) setTimeout(() => void refresh(), 1500);
}, 1000);
setInterval(() => {
  if (client.game && !document.hidden) void refresh();
}, 4000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && client.game) void refresh();
});

// ----- start -----

async function openInvite(token: string): Promise<void> {
  // The token leaves the address bar at once (history, screenshots).
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const j = await api('/api/invite/check', { token });
    ui.invite = {
      token,
      email: String(j.email),
      galaxies: Number(j.galaxies) || 1,
    };
    ui.auth = 'register';
  } catch (e) {
    ui.auth = 'login';
    toast((e as Error).message, true);
  }
}

function openReset(): boolean {
  const token = /^#reset=([\w-]{43})$/.exec(location.hash)?.[1];
  if (!token) return false;
  history.replaceState(null, '', location.pathname + location.search);
  resetToken = token;
  loginChallenge = null;
  client.game = null;
  ui.auth = 'reset';
  render(true);
  return true;
}

const inviteToken = (): string | undefined =>
  /^#invite=([\w-]+)$/.exec(location.hash)?.[1];

window.addEventListener('popstate', () => {
  if (!inviteToken())
    go(viewFromUrl(), false, new URLSearchParams(location.search).get('guild'));
});

// An invitation link opened in a tab that is already open only changes the hash.
window.addEventListener('hashchange', () => {
  if (openReset()) return;
  const token = inviteToken();
  if (!token || client.game) return;
  void openInvite(token).then(() => render(true));
});

async function loadPasswordPolicy(): Promise<void> {
  const policy = await api('/api/account/policy').catch(() => null);
  ui.webPush = policy?.webPush === true;
  const minimum = policy?.passwordMinLength;
  if (
    typeof minimum === 'number' &&
    Number.isSafeInteger(minimum) &&
    minimum > 0
  )
    ui.passwordMinLength = minimum;
}

async function boot(): Promise<void> {
  const policy = loadPasswordPolicy();
  if (openReset()) {
    await policy;
    booting = false;
    render();
    return;
  }
  await policy;
  const invite = inviteToken();
  try {
    apply((await api('/api/state')) as unknown as GameState);
    homeSystem();
  } catch {
    if (invite) await openInvite(invite);
    ui.auth ??= 'login';
  }
  booting = false;
  render(true);
}

void boot();
