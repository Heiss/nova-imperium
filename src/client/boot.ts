// The start of the page (formerly in main.ts): the password policy, a link
// to reset the password or to register with an invitation, then the state of
// a session that is still there, or the login.
import { api } from './api.ts';
import { homeSystem, login } from './logic/login.ts';
import { client } from './logic/state.svelte.ts';
import type { GameState } from './logic/types.ts';
import { forgetNews } from './news.ts';
import { render } from './render.ts';
import { session } from './session.ts';
import { apply, refresh } from './sync.ts';
import { toast } from './toast.ts';

const ui = client.ui;

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
    toast((e as Error).message, e as Error);
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

/** The token of an invitation link in the address, if there is one. */
export const inviteToken = (): string | undefined =>
  /^#invite=([\w-]+)$/.exec(location.hash)?.[1];

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

export async function boot(): Promise<void> {
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

/** The maintenance is over: the news may be new, and a page without a state starts again. */
export function resumeAfterMaintenance(): void {
  forgetNews();
  // Maintenance during the first load left no state: load from scratch.
  void (client.game ? refresh() : boot());
}

/** An invitation or reset link opened in a tab that is already open only changes the hash. */
export function watchLinks(): void {
  window.addEventListener('hashchange', () => {
    if (openReset()) return;
    const token = inviteToken();
    if (!token || client.game) return;
    void openInvite(token).then(() => render(true));
  });
}
