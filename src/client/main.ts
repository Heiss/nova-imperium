// The browser glue: server calls, rendering, events and the clock. The state
// lives in the state module (logic/state.svelte.ts, #118); the views are pure
// functions (views/) or Svelte components; the logic is tested (logic/); this
// file is run by the E2E suite.
import { flushSync } from 'svelte';
import { settle, settleR } from '../core/settle.ts';
import type { Planet } from '../core/types.ts';
import { createAct, placeOf, samePlace } from './logic/act.ts';
import { stateUrl, viewUrl } from './logic/address.ts';
import { catalogKind } from './logic/catalog-list.ts';
import * as demolition from './logic/demolition.ts';
import { scanOf } from './logic/phalanx.ts';
import { dur } from './logic/format.ts';
import { headerLine } from './logic/header.ts';
import { keeps, viewDue } from './logic/jump-gate.ts';
import { chatToSee, finishedYardOrders } from './logic/menu-hints.ts';
import { latestNews, NEWS_SEEN_KEY, type NewsData } from './logic/news.ts';
import { hiddenView, navigation } from './logic/navigation.ts';
import { ANIMATION_KEY, animationsOn } from './logic/planet.ts';
import { homeSystem, login } from './logic/login.ts';
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
import { forgetAdminPanel } from './views/admin-panel.ts';
import { mountAuth } from './views/auth.ts';
import { renderGate } from './views/vacation-lock.ts';
import { ANEW, type Mounted, MOUNTED, mountView } from './views/mount.ts';
import { api } from './api.ts';
import { $, closeMore, keepChatScroll } from './dom.ts';
import { watchErrors } from './error-log.ts';
import { whenBack } from './maintenance.ts';
import { session, signedOut, whenSignedOut } from './session.ts';
import { toast } from './toast.ts';
import { modal } from './modal.ts';
import {
  assembleActs,
  assembleForms,
  runAfterRender,
} from './features/assemble.ts';
import type { ClientCtx } from './features/contract.ts';
import { CLIENT_FEATURES } from './features/index.gen.ts';

/** The mounted Svelte view and its name. */
let mounted: Mounted | null = null;

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

function apply(st: GameState | undefined, fresh = false): void {
  if (!st || login.resetToken) return;
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
  view.replaceChildren();
  if (ui.auth) mounted = { view: 'auth', ...mountAuth(view, ui) };
  else view.innerHTML = '<div class="notice">Lade …</div>';
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

/**
 * Mounts the view of a Svelte component, or updates the mounted one. A
 * fresh render mounts a list again, as the HTML views render anew: no
 * number typed into the shipyard stays on another planet. The overview, the
 * Sternenkarte and the fleet view are mounted anew on every render, as their
 * HTML views were rendered (#118): the clock counts their countdowns down
 * and marks the ones that fired.
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
  mounted = mountView(ui.view, target, view);
  flushSync();
}

function renderView(target: HTMLElement, view: V, fresh: boolean): void {
  const show = Object.entries(VIEWS).find(([name]) => name === ui.view)?.[1];
  if (MOUNTED.has(ui.view) || !show) return renderMounted(target, view, fresh);
  unmountViews();
  target.innerHTML = show(view);
}

/** The view state moved to now. */
function viewAt(state: GameState, planet: Planet, now: number): V {
  const here = settle(planet, now, state.cfg, state.me);
  return { s: state, P: here, R: settleR(state.me, now), now, ui };
}

function render(fresh = false): void {
  const view = $('#view')!;
  if (!client.game) {
    forgetAdminPanel();
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
  renderCompletions(view);
  paintPlanets(view);
  restore();
  chatScroll();
  runAfterRender(CLIENT_FEATURES);
  if (ui.view === 'messages') markRead();
  seeChat();
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

/** What the features need from this file (features/contract.ts). */
const ctx: ClientCtx = {
  act,
  actHere,
  modal,
  go,
  render,
  api,
  toast,
  setInput,
  apply,
  signedOut,
};
const ACT = assembleActs({}, CLIENT_FEATURES, ctx);

// ----- events -----

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  const fn = el ? ACT[el.dataset.act!] : undefined;
  if (!el || !fn) return;
  const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
  if (el instanceof HTMLAnchorElement && (modified || e.button !== 0)) return;
  e.preventDefault();
  void fn({ ...el.dataset });
});
const FORMS = assembleForms({}, CLIENT_FEATURES, ctx);
document.addEventListener('submit', (e) => {
  const id = (e.target as HTMLElement).id;
  const handle = Object.hasOwn(FORMS, id) ? FORMS[id] : undefined;
  if (!handle) return;
  e.preventDefault();
  void handle();
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
  login.resetToken = token;
  login.challenge = null;
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
    session.booting = false;
    render();
    return;
  }
  await policy;
  const invite = inviteToken();
  try {
    apply((await api('/api/state')) as unknown as GameState);
    homeSystem(ui, client.game);
  } catch {
    if (invite) await openInvite(invite);
    ui.auth ??= 'login';
  }
  session.booting = false;
  render(true);
}

watchErrors();
whenSignedOut(() => render(true));
whenBack(() => {
  // An update may have brought a new version: load its news again.
  ui.news = null;
  newsLoading = false;
  newsLoad++;
  // Maintenance during the first load left no state: load from scratch.
  void (client.game ? refresh() : boot());
});
void boot();
