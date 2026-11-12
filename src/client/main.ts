// The browser glue: state, server calls, rendering, events and the clock.
// The views are pure functions (views/), the logic is tested (logic/); this
// file is run by the E2E suite.
import { BUILD, RES } from '../shared/catalog.ts';
import { pid } from '../shared/flight.ts';
import { settle, settleR } from '../shared/settle.ts';
import { orderMax, yardLockedBy } from '../shared/yard.ts';
import type { Levels, Planet, Queue } from '../shared/types.ts';
import { clampInt, coords, dt, dur, esc, fmt } from './logic/format.ts';
import {
  cargoMax,
  fleetPreview,
  galaxyStep,
  nameOf,
  settingsFrom,
  unread,
  type FleetForm,
} from './logic/game.ts';
import { resourceIconURL, type ResourceKey } from './logic/icons.ts';
import { finishedYardOrders, menuHints } from './logic/menu-hints.ts';
import { gameIsBack, maintenanceNotice } from './logic/maintenance.ts';
import {
  latestNews,
  NEWS_SEEN_KEY,
  type NewsData,
  newsHint,
} from './logic/news.ts';
import { ANIMATION_KEY, animationsOn } from './logic/planet.ts';
import type { GameState } from './logic/types.ts';
import { afford, caps, lvlCost, production } from '../shared/economy.ts';
import type { Ui, V } from './views/common.ts';
import {
  menu,
  phoneMenu,
  TAB_GLYPHS,
  VIEWS,
  type MenuEntry,
} from './views/index.ts';
import {
  loadInvitations,
  mountAdminDiagnostics,
} from './views/admin-diagnostics.ts';
import {
  ADMIN_TABS,
  auth,
  diagnosticTab,
  roundDialog,
  type AdminTab,
} from './views/misc.ts';
import { disablePush, enablePush } from './push.ts';
import { mountBuildings } from './views/buildings.ts';

import { addPasskey, signInWithPasskey } from './passkeys.ts';

type Data = Record<string, string | undefined>;

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);
const val = (sel: string): string => $<HTMLInputElement>(sel)?.value ?? '';

let S: GameState | null = null;
let loginChallenge: string | null = null;
let rememberLogin = false;
let resetToken: string | null = null;
let offset = 0;
let lastKey = '';
let ctx: V | null = null;
let buildingView: ReturnType<typeof mountBuildings> | null = null;
let adminPanel: {
  diagnostics: HTMLElement;
  invitations: HTMLElement;
  user: string;
  tab: AdminTab;
  panel: ReturnType<typeof mountAdminDiagnostics>;
} | null = null;
let lastActivity = -Infinity;
const completionNotices = new Set<string>();
const completedMenu = new Map<string, string>();

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
    if (S) render();
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
  if (!view || (view !== 'buildings' && !Object.hasOwn(VIEWS, view)))
    return 'overview';
  if (view === 'admin' && S && !S.me.admin) return 'overview';
  if (view === 'achievements' && !rewardsAvailable(S)) return 'overview';
  return view;
}

function rewardsAvailable(state: GameState | null): boolean {
  return !state || state.round.achievements || state.round.daily;
}

const viewFromUrl = (): string =>
  gameView(new URLSearchParams(location.search).get('view'));

function viewUrl(view: string, guild: string | null = null): string {
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  if (view === 'guilds' && guild) url.searchParams.set('guild', guild);
  else url.searchParams.delete('guild');
  url.hash = '';
  return url.pathname + url.search;
}

const ui: Ui = {
  view: viewFromUrl(),
  guild: new URLSearchParams(location.search).get('guild'),
  gal: 1,
  sys: 1,
  ft: null,
  fm: 'attack',
  openRep: {},
  openEx: {},
  auth: null,
  invite: null,
  lastLink: null,
  animations: animationsOn(() => localStorage.getItem(ANIMATION_KEY)),
  news: null,
  newsSeen: readNewsSeen(),
};
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

const nowT = (): number => Date.now() + offset;

// ----- messages -----

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
      void (S ? refresh() : boot());
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
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function modal(html: string): void {
  const m = $('#modal')!;
  $('#modalIn')!.innerHTML = html;
  m.classList.toggle('show', html !== '');
}

// ----- server -----

class AuthError extends Error {}

async function api(
  url: string,
  body?: unknown,
  retryBusy = true,
): Promise<Record<string, unknown>> {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const j = (await r
    .json()
    .catch(() => ({ error: 'Keine Antwort vom Server.' }))) as Record<
    string,
    unknown
  >;
  stopOnMaintenance(r, j);
  if (r.status === 401) {
    S = null;
    ui.auth ??= 'login';
    render(true);
    throw new AuthError(String(j.error ?? 'Bitte einloggen.'));
  }
  if (isRetryableAction(r, j, retryBusy)) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return api(url, body, false);
  }
  if (!r.ok) throw apiError(r, j.error);
  return j;
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
  const same = key === lastKey;
  lastKey = key;
  if (S && (st.me.id !== S.me.id || st.round.number !== S.round.number)) {
    completedMenu.clear();
    completionNotices.clear();
    ctx = null;
  }
  offset = st.now - Date.now();
  S = st;
  void loadNews();
  const view = gameView(ui.view);
  if (view !== ui.view) {
    ui.view = view;
    history.replaceState(null, '', viewUrl(view));
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
  const player = S?.me.id;
  try {
    const state = (await api(stateUrl(id))) as unknown as GameState;
    if (
      request !== planetRequest ||
      !player ||
      S?.me.id !== player ||
      state.planet?.id !== id
    )
      return;
    completedMenu.clear();
    completionNotices.clear();
    ctx = null;
    apply(state, true);
  } catch (e) {
    toast((e as Error).message, true);
  }
}

function stillOnPlanet(player?: string, planet?: string): boolean {
  return !!S && S.me.id === player && S.planet?.id === planet;
}

async function refresh(): Promise<void> {
  const player = S?.me.id;
  const planet = S?.planet?.id;
  try {
    const state = (await api(
      stateUrl(planet === S?.homePlanet ? undefined : planet),
    )) as unknown as GameState;
    if (stillOnPlanet(player, planet)) apply(state);
  } catch (e) {
    if (S) console.warn(e);
  }
}

async function act(type: string, data: object = {}): Promise<boolean> {
  try {
    const planet = S?.planet?.id;
    const player = S?.me.id;
    const j = await api('/api/action', { type, planet, ...data });
    if (stillOnPlanet(player, planet)) apply(j.state as GameState);
    if (j.msg) toast(String(j.msg));
    return true;
  } catch (e) {
    toast((e as Error).message, true);
    return false;
  }
}

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
  const focus = document.activeElement?.id;
  if (!fresh)
    view
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input[id],select[id],textarea[id]')
      .forEach((i) => (saved[i.id] = i.value));
  return () => {
    for (const [id, v] of Object.entries(saved)) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.hasAttribute('data-nokeep')) el.value = v;
    }
    if (focus) document.getElementById(focus)?.focus();
  };
}

function renderLoggedOut(view: HTMLElement): void {
  ctx = null;
  unmountBuildings();
  completionNotices.clear();
  completedMenu.clear();
  $('#menu')!.innerHTML = '';
  $('#tabbar')!.innerHTML = '';
  $('#more-list')!.innerHTML = '';
  $('#resbar')!.innerHTML = '';
  $('#pinfo')!.innerHTML = '';
  view.innerHTML = ui.auth ? auth(ui) : '<div class="notice">Lade …</div>';
}

function rememberUpgrade(
  order: Queue | null,
  levels: Levels,
  catalog: Record<string, { n: string }>,
  view: string,
  label: string,
  now: number,
): void {
  if (!order || order.end > now || (levels[order.key] ?? 0) < order.lvl) return;
  const name = catalog[order.key]?.n ?? order.key;
  completedMenu.set(view, label);
  completionNotices.add(`${label}: ${name} (Stufe ${order.lvl}).`);
}

function rememberCompletions(previous: V, next: V): void {
  if (previous.P.id !== next.P.id) return;
  rememberUpgrade(
    previous.P.bq,
    next.P.b,
    BUILD,
    'buildings',
    'Ausbau fertig',
    next.now,
  );
  rememberUpgrade(
    previous.R.rq,
    next.R.research,
    RES,
    'research',
    'Forschung fertig',
    next.now,
  );
  for (const view of finishedYardOrders(previous.P, next.now)) {
    completedMenu.set(view, 'Werftauftrag fertig');
    completionNotices.add('Werftauftrag fertig.');
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
    completedMenu.set('fleet', 'Flotte zurückgekehrt');
}

function renderCompletions(view: HTMLElement): void {
  view.querySelector('#completion-notice')?.remove();
  if (!completionNotices.size) return;
  const notice = document.createElement('div');
  notice.id = 'completion-notice';
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  notice.textContent = [...completionNotices].join(' ');
  view.prepend(notice);
}

/** Opens or closes the explanation below an entry (issue #63, D3). */
function toggleExplanation(key: string): void {
  const open = !ui.openEx[key];
  ui.openEx[key] = open;
  // Svelte keeps the focused button and only changes its attributes.
  if (buildingView && ctx) return buildingView.update({ ...ctx });
  document
    .getElementById(`exq_${key}`)
    ?.setAttribute('aria-expanded', String(open));
  const panel = document.getElementById(`ex_${key}`);
  if (panel) panel.hidden = !open;
}

function unmountBuildings(): void {
  buildingView?.destroy();
  buildingView = null;
}

function renderView(target: HTMLElement, view: V): void {
  if (ui.view !== 'admin' || !view.s.me.admin) adminPanel = null;
  if (ui.view === 'buildings') {
    if (buildingView) buildingView.update(view);
    else {
      target.replaceChildren();
      buildingView = mountBuildings(target, view);
    }
    return;
  }
  unmountBuildings();
  const show = Object.entries(VIEWS).find(([name]) => name === ui.view)?.[1];
  target.innerHTML = (show ?? VIEWS.overview!)(view);
  if (ui.view === 'admin' && view.s.me.admin) renderAdminPanel(target, view);
}

function renderAdminPanel(target: HTMLElement, view: V): void {
  const diagnostics = target.querySelector<HTMLElement>('#admin-diagnostics')!;
  const invitations = target.querySelector<HTMLElement>('#admin-invitations')!;
  if (adminPanel?.user === view.s.me.id) {
    diagnostics.replaceWith(adminPanel.diagnostics);
    invitations.replaceWith(adminPanel.invitations);
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
    user: view.s.me.id,
    tab: 'events',
    panel,
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
}

function refreshInvitations(): void {
  if (adminPanel) void loadInvitations(adminPanel.invitations, api);
}

function renderPlanetHeader({ s, P }: V): void {
  const owned = s.galaxy.filter((p) => p.owner === s.me.id);
  const activeId = P.id;
  const selector =
    owned.length > 1
      ? ` · <select id="planet_select" aria-label="Aktiver Planet">${owned.map((p) => `<option value="${esc(p.id)}" ${p.id === activeId ? 'selected' : ''}>${esc(p.name)} ${coords(p)}</option>`).join('')}</select>`
      : '';
  $('#pinfo')!.innerHTML =
    `<b>${esc(P.name)}</b> ${coords(P)} · Kommandant <b>${esc(s.me.name)}</b> · <span class="lnk" data-act="logout">Logout</span>${selector}`;
}

/** The view state moved to now. */
function viewAt(state: GameState, planet: Planet, now: number): V {
  const here = settle(planet, now, state.cfg, state.me);
  return { s: state, P: here, R: settleR(state.me, now), now, ui };
}

function render(fresh = false): void {
  const view = $('#view')!;
  if (!S) {
    adminPanel = null;
    lastActivity = -Infinity;
    return renderLoggedOut(view);
  }
  if (!S.planet) {
    ctx = null;
    unmountBuildings();
    view.innerHTML =
      '<div class="notice">Du hast keinen Planeten. Bitte den Admin, eine neue Runde zu starten.</div>';
    return;
  }
  const restore = keepInputs(view, fresh);
  const now = nowT();
  const previous = ctx;
  ctx = viewAt(S, S.planet, now);
  if (previous && !fresh) rememberCompletions(previous, ctx);
  renderMenu();
  updateBar();
  renderPlanetHeader(ctx);
  renderView(view, ctx);
  if (ui.view === 'help') updateInstallButton();
  renderCompletions(view);
  paintPlanets(view);
  restore();
  if (ui.view === 'fleet') fleetCalc();
  if (ui.view === 'achievements') filterAchievements();
  if (ui.view === 'messages') markRead();
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

function menuBadge(hint: string | undefined): string {
  return hint
    ? `<span class="badge" role="img" aria-label="${esc(hint)}" title="${esc(hint)}">!</span>`
    : '';
}

function menuLink(
  i: MenuEntry,
  hint: string | undefined,
  inner: string,
): string {
  const current = ui.view === i.view ? ' aria-current="page"' : '';
  return `<a href="${esc(viewUrl(i.view))}" data-act="nav" data-v="${i.view}" class="${ui.view === i.view ? 'on' : ''}"${current}>${inner}${menuBadge(hint)}</a>`;
}

/** Phone: tab bar and the list of the „Mehr“ sheet. */
function renderPhoneMenu(
  items: (MenuEntry | '-')[],
  hints: Map<string, string>,
): void {
  const { tabs, more } = phoneMenu(items);
  const moreHint = more.some((i) => hints.has(i.view));
  const moreOn = more.some((i) => i.view === ui.view);
  $('#tabbar')!.innerHTML =
    tabs
      .map((i) =>
        menuLink(
          i,
          hints.get(i.view),
          `${TAB_GLYPHS[i.view]}<span>${esc(i.label)}</span>`,
        ),
      )
      .join('') +
    `<button type="button" class="${moreOn ? 'on' : ''}" data-act="moreOpen" aria-haspopup="dialog">${TAB_GLYPHS.more}<span>Mehr</span>${moreHint ? '<span class="dot" role="img" aria-label="Neues unter Mehr"></span>' : ''}</button>`;
  $('#more-list')!.innerHTML = more
    .map((i) =>
      menuLink(
        i,
        hints.get(i.view),
        `<span>${esc(i.label)}</span>${TAB_GLYPHS.chevron}`,
      ),
    )
    .join('');
}

function renderMenu(): void {
  const state = S!;
  if (ui.view === 'news') seeNews();
  const hints = menuHints(
    state,
    completedMenu,
    unread(state.reports, state.me.readAt),
  );
  const news = newsHint(ui.news, ui.newsSeen);
  if (news) hints.set('news', news);
  const items = menu(state.me.admin, state.round);
  $('#menu')!.innerHTML = items
    .map((i) =>
      i === '-'
        ? '<div class="sep"></div>'
        : menuLink(i, hints.get(i.view), esc(i.label)),
    )
    .join('');
  renderPhoneMenu(items, hints);
}

function updateBar(): Planet | undefined {
  if (!S?.planet) return;
  const now = nowT();
  const p = settle(S.planet, now, S.cfg, S.me);
  const pr = production(p, S.cfg, settleR(S.me, now).research);
  const cp = caps(p, S.cfg);
  const icon = (key: ResourceKey): string =>
    `<img class="ri" src="${resourceIconURL(key)}" alt="" width="28" height="28">`;
  const r = (
    label: string,
    key: ResourceKey,
    v: number,
    cap: number,
    per: number,
  ): string =>
    `<div class="res" title="${per < 0 ? '' : '+'}${fmt(per)}/h · Lager ${fmt(cap)}">${icon(key)}<div><div class="l">${label}</div><div class="v ${v >= cap ? 'full' : ''}">${fmt(v)}</div></div></div>`;
  $('#resbar')!.innerHTML =
    r('Metall', 'metal', p.res.m, cp.m, pr.m) +
    r('Kristall', 'crystal', p.res.c, cp.c, pr.c) +
    r('Deuterium', 'deuterium', p.res.d, cp.d, pr.d) +
    `<div class="res">${icon('energy')}<div><div class="l">Energie</div><div class="v ${pr.eProd - pr.eUse < 0 ? 'bad' : ''}">${fmt(pr.eProd - pr.eUse)}/${fmt(pr.eProd)}</div></div></div>`;
  return p;
}

function updateResearchButtons(p: Planet, research: Levels): void {
  document
    // „Jetzt forschen“ (.go) carries its own state from the requirement list.
    .querySelectorAll<HTMLButtonElement>(
      '#view button[data-act="research"]:not(.go)',
    )
    .forEach((button) => {
      const key = button.dataset.k!;
      const level = research[key] ?? 0;
      button.disabled = !afford(p, lvlCost(RES[key]!, level + 1));
    });
}

function updateShipyardButtons(p: Planet): void {
  document
    .querySelectorAll<HTMLElement>('#view [data-act="maxq"]')
    .forEach((max) => {
      const count = orderMax(p, max.dataset.k!);
      if (max.dataset.max !== String(count)) {
        max.dataset.max = String(count);
        max.textContent = `(max ${fmt(count)})`;
      }
      const button = max
        .closest('.act')!
        .querySelector<HTMLButtonElement>('button')!;
      button.disabled = !!yardLockedBy(p) || count === 0;
    });
}

let readPending = false;
function markRead(): void {
  const list = S!.reports;
  const newest = Math.max(0, ...list.map((r) => r.time));
  if (newest > (S!.me.readAt || 0) && !readPending) {
    readPending = true;
    setTimeout(
      () => void act('read').finally(() => (readPending = false)),
      600,
    );
  }
}

// ----- fleet form -----

function readFleetForm(): FleetForm {
  const ships: Record<string, number> = {};
  const P = ctx!.P;
  const u = S!.cfg;
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

function fleetCalc(): void {
  if (!$('#t_g') || !ctx || !S) return;
  const f = readFleetForm();
  const target = S.galaxy.find((p) => p.id === pid(f.to));
  $('#t_info')!.innerHTML = target
    ? `${esc(target.name)} (${esc(nameOf(S.players, target.owner))})`
    : f.mission === 'colonize'
      ? 'Freie Position'
      : '<span class="bad">kein Planet</span>';
  const pv = fleetPreview(ctx.P, ctx.R, f, S.cfg);
  const set = (id: string, html: string): void =>
    void ($(`#${id}`)!.innerHTML = html);
  if (!pv)
    return ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].forEach((id) =>
      set(id, '-'),
    );
  const now = nowT();
  set('i_dist', fmt(pv.dist));
  set('i_dur', dur(pv.ms));
  set('i_arr', `${dt(now + pv.ms)} / ${dt(now + 2 * pv.ms)}`);
  set(
    'i_fuel',
    `<span class="${pv.fuelShort ? 'bad' : ''}">${fmt(pv.fuel)}</span> Deuterium`,
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
    completionNotices.clear();
    if (push) history.pushState(null, '', viewUrl(view, guild));
  }
  completedMenu.delete(view);
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
  nav: (d) => go(d.v ?? 'overview'),
  guildView: (d) => go('guilds', true, d.id ?? null),
  guildApply: (d) => act('applyToGuild', { id: d.id }),
  guildLeave: (d) => {
    if (!d.confirm || window.confirm(d.confirm)) return act('leaveGuild');
  },
  guildReview: (d) =>
    act('reviewGuildApplication', { uid: d.uid, accept: d.accept === '1' }),
  guildMember: (d) => {
    const transfer = d.transfer === '1';
    if (
      window.confirm(
        transfer ? 'Gildenleitung übergeben?' : 'Mitglied entfernen?',
      )
    )
      return act('manageGuildMember', { uid: d.uid, transfer });
  },
  achievementClaim: (d) => act('claimAchievement', { id: d.id }),
  dailyClaim: () => act('claimDailyReward'),
  logout: async () => {
    await disablePush(api).catch(() => null);
    await api('/api/logout', {}).catch(() => null);
    S = null;
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
  research: (d) => act('research', { key: d.k }),
  cancelResearch: () => act('cancelResearch'),
  maxq: (d) => setInput(`#q_${d.k}`, d.max ?? 0),
  order: async (d) => {
    const n = clampInt(val(`#q_${d.k}`), 0, 1e9);
    if (!n) return toast('Bitte eine Anzahl eingeben.', true);
    if (await act('order', { key: d.k, n })) setInput(`#q_${d.k}`, '');
  },
  rename: () =>
    modal(
      `<p><b>Planet umbenennen</b></p><input id="rn" maxlength="20" value="${esc(ctx!.P.name)}" aria-label="Neuer Name"> <button data-act="doRename">OK</button> <button data-act="closeModal">Abbrechen</button>`,
    ),
  doRename: () => {
    const n = val('#rn').trim();
    modal('');
    if (n) void act('rename', { name: n });
  },
  closeModal: () => modal(''),
  gnav: (d) => {
    Object.assign(ui, galaxyStep(ui.gal, ui.sys, d.d ?? '', S!.cfg));
    render(true);
  },
  ggo: () => {
    ui.gal = clampInt(val('#g_g'), 1, S!.cfg.galaxies);
    ui.sys = clampInt(val('#g_s'), 1, S!.cfg.systems);
    render(true);
  },
  selectPlanet: (d) => {
    if (d.id) return selectPlanet(d.id);
  },
  ghome: () => {
    const home = S!.galaxy.find((p) => p.id === S!.homePlanet) ?? ctx!.P;
    ui.gal = home.g;
    ui.sys = home.s;
    render(true);
  },
  gto: (d) => {
    ui.gal = Number(d.g);
    ui.sys = Number(d.s);
    go('galaxy');
  },
  gfleet: (d) => {
    ui.ft = { g: Number(d.g), s: Number(d.s), p: Number(d.p) };
    ui.fm = d.m ?? 'attack';
    go('fleet');
  },
  gspy: (d) => {
    const n = Math.min(ctx!.P.ships.probe ?? 0, S!.me.probes || 1);
    if (!n) return toast('Keine Spionagesonden auf dem Planeten.', true);
    return act('send', {
      ships: { probe: n },
      to: { g: Number(d.g), s: Number(d.s), p: Number(d.p) },
      mission: 'spy',
      pct: 10,
      cargo: { m: 0, c: 0, d: 0 },
    });
  },
  fmax: (d) => {
    setInput(`#f_${d.k}`, ctx!.P.ships[d.k!] ?? 0);
    fleetCalc();
  },
  fall: () => {
    document
      .querySelectorAll<HTMLInputElement>('.fs')
      .forEach((i) => (i.value = String(ctx!.P.ships[i.dataset.k!] ?? 0)));
    fleetCalc();
  },
  fnone: () => {
    document
      .querySelectorAll<HTMLInputElement>('.fs')
      .forEach((i) => (i.value = ''));
    fleetCalc();
  },
  cmax: () => {
    const c = cargoMax(
      settle(S!.planet!, nowT(), S!.cfg, S!.me),
      readFleetForm(),
    );
    setInput('#c_m', c.m);
    setInput('#c_c', c.c);
    setInput('#c_d', c.d);
    fleetCalc();
  },
  send: async () => {
    if (await act('send', readFleetForm())) {
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
  explain: (d) => toggleExplanation(d.k!),
  saveopt: () =>
    act('options', {
      probes: clampInt(val('#o_probes'), 1, 1e6),
      explain: val('#o_explain'),
    }),
  adminTab: (d) => {
    if (d.tab && Object.hasOwn(ADMIN_TABS, d.tab))
      openAdminTab(d.tab as AdminTab);
  },
  listPasskeys: showPasskeys,
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
  deleteAccount: () =>
    modal(
      '<form id="deleteaccountform"><p>Dein Konto und deine Spielstände werden unwiderruflich gelöscht. Eine von dir geleitete Gilde wird aufgelöst.</p><p><label for="delete-account-password">Passwort zur Bestätigung</label> <input id="delete-account-password" type="password" autocomplete="current-password" required></p><button class="red" type="submit">Account endgültig löschen</button> <button type="button" data-act="closeModal">Abbrechen</button></form>',
    ),
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
  reset: () => modal(roundDialog(S!.round)),
  doReset: () => {
    const checked = (id: string) => $<HTMLInputElement>(id)!.checked;
    const rewards = {
      achievements: checked('#round-achievements'),
      daily: checked('#round-daily'),
    };
    modal('');
    return act('reset', { rewards });
  },
  saveSettings: () => {
    const keys = S!.admin!.specs.map((x) => x.key);
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
    if (reg && S?.planet)
      toast(
        `Willkommen, ${S.me.name}! Dein Planet liegt bei ${coords(S.planet)}.`,
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
    S = null;
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
    S = null;
    ui.auth = 'login';
    render(true);
    toast('Dein Account wurde gelöscht.');
  } catch (error) {
    toast((error as Error).message, true);
    button.disabled = false;
  }
}

async function submitGuild(): Promise<void> {
  const edit = $('#guildform')?.dataset.edit === '1';
  const ok = await act(edit ? 'updateGuild' : 'createGuild', {
    tag: val('#guild_tag'),
    name: val('#guild_name'),
    description: val('#guild_description'),
  });
  if (ok && !edit) go('guilds', true, S?.guilds?.own?.id ?? null);
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
  if (S?.planet) {
    ui.gal = S.planet.g;
    ui.sys = S.planet.s;
  }
}

// ----- events -----

function noteActivity(event: Event): void {
  if (!S || !event.isTrusted || document.visibilityState !== 'visible') return;
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
    ['codeform', submitLoginCode],
    ['forgotform', submitForgot],
    ['resetform', () => submitPassword(true)],
    ['passwordform', () => submitPassword(false)],
    ['passkeyform', submitPasskey],
    ['deleteaccountform', submitAccountDeletion],
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

function queueDue(view: V, now: number): boolean {
  const ship = view.P.sq[0];
  const nextShip = ship ? (view.P.sqT ?? now) + ship.unit : Infinity;
  return (
    Math.min(
      view.P.bq?.end ?? Infinity,
      view.R.rq?.end ?? Infinity,
      nextShip,
    ) <= now
  );
}

setInterval(() => {
  if (!ctx) return;
  const now = nowT();
  if (queueDue(ctx, now)) {
    render();
    void refresh();
    return;
  }
  let due = false;
  document
    .querySelectorAll<HTMLElement>(buildingView ? '.cd:not(#view *)' : '.cd')
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
  if (planet) {
    buildingView?.update({
      ...ctx,
      P: planet,
      now,
    });
    updateResearchButtons(planet, ctx.R.research);
    updateShipyardButtons(planet);
  }
  if (due) setTimeout(() => void refresh(), 1500);
}, 1000);
setInterval(() => {
  if (S && !document.hidden) void refresh();
}, 4000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S) void refresh();
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
  S = null;
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
  if (!token || S) return;
  void openInvite(token).then(() => render(true));
});

async function loadPasswordPolicy(): Promise<void> {
  const policy = await api('/api/account/policy').catch(() => null);
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
    render();
    return;
  }
  await policy;
  const invite = inviteToken();
  try {
    apply((await api('/api/state')) as unknown as GameState);
    homeSystem();
    render(true);
  } catch {
    if (invite) await openInvite(invite);
    ui.auth ??= 'login';
    render(true);
  }
}

void boot();
