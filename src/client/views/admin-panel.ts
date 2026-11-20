// The panels of the page „Admin“ that fill themselves from the server (#118,
// bundle 7; formerly in main.ts): the diagnostics, the list of errors and the
// list of the invitations. The component Admin draws the frame and leaves
// three plain elements for them (`#admin-diagnostics`, `#admin-errors`,
// `#admin-invitations`). The page is mounted anew on every render, so the
// panels are kept: after each mount the elements of the earlier render (with
// what they loaded and what was typed into their filters) replace the empty
// ones, as long as it is the same admin. This module also shows the tab
// (`aria-selected`, `hidden`) and loads what the tab needs.
import { $ } from '../dom.ts';
import { ADMIN_TABS, type AdminTab, diagnosticTab } from '../logic/admin.ts';
import type { V } from './common.ts';
import { loadInvitations, mountAdminDiagnostics } from './admin-diagnostics.ts';
import { downloadErrors, mountAdminErrors } from './admin-errors.ts';

/** What the panels need from the frame: the calls of the server, and the way back to the login. */
export interface PanelDeps {
  api: (url: string, body?: unknown) => Promise<Record<string, unknown>>;
  signedOut: (error: unknown) => never;
}

let deps: PanelDeps | null = null;

/** Hands the panels the calls of the frame (once, by features/admin.ts). */
export const bindAdminPanel = (given: PanelDeps): void => {
  deps = given;
};

let panel: {
  diagnostics: HTMLElement;
  invitations: HTMLElement;
  errors: HTMLElement;
  user: string;
  tab: AdminTab;
  diagnosticsPanel: ReturnType<typeof mountAdminDiagnostics>;
  errorPanel: ReturnType<typeof mountAdminErrors>;
} | null = null;

/** Drops the panels, for a render that is no longer the page „Admin“ of an admin. */
export const forgetAdminPanel = (): void => {
  panel = null;
};

function paintAdminTab(tab: AdminTab): void {
  const selected = diagnosticTab(tab) ? 'diagnostics' : tab;
  const shown = $(`#admin-panel-${selected}`)!;
  for (const item of document.querySelectorAll<HTMLElement>(
    '#view [role=tabpanel]',
  ))
    item.hidden = item !== shown;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '#view [role=tab]',
  )) {
    const active = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  shown.setAttribute('aria-labelledby', `admin-tab-${tab}`);
}

/** Shows the tab and loads what it needs. */
export function openAdminTab(tab: AdminTab, value?: string): void {
  if (!panel) return;
  panel.tab = tab;
  paintAdminTab(tab);
  if (diagnosticTab(tab)) void panel.diagnosticsPanel.open(tab, value);
  if (tab === 'invitations') refreshInvitations();
  if (tab === 'errors') void panel.errorPanel.open();
}

/** Loads the list of the invitations again. */
export function refreshInvitations(): void {
  if (panel && deps) void loadInvitations(panel.invitations, deps.api);
}

/**
 * Puts the panels into the page just mounted: the ones of the earlier render
 * for the same admin, else new ones on the tab „Ereignisprotokoll“.
 */
export function attachAdminPanel(target: HTMLElement, view: V): void {
  const { api, signedOut } = deps!;
  const diagnostics = target.querySelector<HTMLElement>('#admin-diagnostics')!;
  const invitations = target.querySelector<HTMLElement>('#admin-invitations')!;
  const errors = target.querySelector<HTMLElement>('#admin-errors')!;
  if (panel?.user === view.s.me.id) {
    diagnostics.replaceWith(panel.diagnostics);
    invitations.replaceWith(panel.invitations);
    errors.replaceWith(panel.errors);
    paintAdminTab(panel.tab);
    return;
  }
  panel = {
    diagnostics,
    invitations,
    errors,
    user: view.s.me.id,
    tab: 'events',
    diagnosticsPanel: mountAdminDiagnostics(
      diagnostics,
      api,
      view.s.players,
      openAdminTab,
    ),
    errorPanel: mountAdminErrors(
      errors,
      api,
      (body) => downloadErrors(body, signedOut),
      Date.now(),
    ),
  };
  openAdminTab('events');
}

/** The arrow keys, Home and End move between the tabs (the pattern of a tab list). */
export function adminTabKey(event: KeyboardEvent): void {
  const selected = (event.target as HTMLElement).closest(
    '[role=tab][data-tab]',
  );
  if (!selected) return;
  const tabs = Object.keys(ADMIN_TABS) as AdminTab[];
  const index = tabs.indexOf(panel?.tab ?? 'events');
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
