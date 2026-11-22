// Drawing the page (formerly in main.ts): the logged-out screen, the menu, the
// resource bar, the header and the view, mounted as a Svelte component or set
// as HTML. What the player typed survives the redraw as the state of the
// forms (logic/form-state.svelte.ts), what finished is shown above the view (completions.ts), and every feature may
// act after a render (features/).
import { flushSync } from 'svelte';
import { settle, settleR } from '../core/settle.ts';
import type { Planet } from '../core/types.ts';
import { drafts } from './logic/drafts.svelte.ts';
import { catalogKind } from './logic/catalog-list.ts';
import { headerLine } from './logic/header.ts';
import { navigation } from './logic/navigation.ts';
import { resourceBar } from './logic/resource-bar.ts';
import { client } from './logic/state.svelte.ts';
import type { GameState } from './logic/types.ts';
import type { Ui, V } from './views/common.ts';
import { VIEWS } from './views/index.ts';
import {
  clearFrame,
  showHeader,
  showNavigation,
  showResourceBar,
} from './views/frame.ts';
import { forgetAdminPanel } from './logic/admin-panels.svelte.ts';
import { mountAuth } from './views/auth.ts';
import { forgetLock, renderGate } from './views/vacation-lock.ts';
import { type Mounted, MOUNTED, mountsAnew, mountView } from './views/mount.ts';
import { $, keepChatScroll } from './dom.ts';
import { rememberCompletions, renderCompletions } from './completions.ts';
import { forgetForms } from './logic/form-state.svelte.ts';
import { seeNews } from './news-seen.ts';
import { urlOf } from './view-address.ts';
import { runAfterRender } from './features/assemble.ts';
import { CLIENT_FEATURES } from './features/index.gen.ts';

const ui: Ui = client.ui;

/** The mounted Svelte view and its name. */
let mounted: Mounted | null = null;

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

function renderLoggedOut(view: HTMLElement): void {
  client.forget();
  forgetLock();
  unmountViews();
  clearFrame();
  view.replaceChildren();
  if (ui.auth) mounted = { view: 'auth', ...mountAuth(view, ui) };
  else view.innerHTML = '<div class="notice">Lade …</div>';
}

/** Unmounts the Svelte view (the lists, the resources). */
function unmountViews(): void {
  mounted?.destroy();
  mounted = null;
}

/** Whether a list is mounted: it shows the clock's view state (#118). */
export const listMounted = (): boolean =>
  !!mounted && !!catalogKind(mounted.view);

/**
 * Mounts the view of a Svelte component, or updates the mounted one. A
 * fresh render mounts a list again, as the HTML views render anew: no
 * number typed into the shipyard stays on another planet. The overview and
 * the fleet view are mounted anew on every render, as their HTML views were
 * rendered (#118): the clock counts their countdowns down and marks the ones
 * that fired. The Sternenkarte is mounted anew by a fresh render only and
 * kept by any other, so its fields keep selection and caret (#352).
 */
function renderMounted(target: HTMLElement, view: V, fresh: boolean): void {
  const kind = catalogKind(ui.view);
  client.shown = view;
  if (mounted?.view === ui.view && !mountsAnew(ui.view, fresh, !!kind)) {
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

export function render(fresh = false): void {
  const view = $('#view')!;
  if (!client.game) {
    forgetAdminPanel();
    drafts.reset();
    forgetForms();
    return renderLoggedOut(view);
  }
  if (renderGate(view, client.game, ui, unmountViews)) return;
  // A fresh render drops what was typed, as it dropped the typed fields.
  if (fresh) {
    drafts.reset();
    forgetForms();
  }
  const focus = document.activeElement?.id;
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
  if (focus) document.getElementById(focus)?.focus();
  chatScroll();
  runAfterRender(CLIENT_FEATURES);
}

function renderMenu(): void {
  if (ui.view === 'news') seeNews();
  showNavigation(
    navigation(client.game!, ui, client.completedMenu, (view) => urlOf(view)),
  );
}

/** Shows the resource bar of the planet moved to now, and returns that planet. */
export function updateBar(): Planet | undefined {
  const game = client.game;
  if (!game?.planet) return;
  const bar = resourceBar(game, game.planet, client.now());
  showResourceBar(bar);
  return bar.planet;
}
