// The session of the player (formerly in main.ts): while the page starts,
// and when the server says the session is gone (a 401).
import { AuthError } from './logic/transport.ts';
import { client } from './logic/state.svelte.ts';

/**
 * True until boot() knows what to show. A 401 meanwhile renders nothing:
 * boot() renders the login, or the registration of an invitation link once
 * the server has checked it. The login rendered before would take the
 * player's input, and the registration would replace it empty (#272).
 */
export const session = { booting: true };

let showLogin: () => void = () => undefined;

/** How the login is put on the page (a fresh render). */
export function whenSignedOut(show: () => void): void {
  showLogin = show;
}

/** The session is gone (401): back to the login, then stop the caller. */
export function signedOut(error: unknown): never {
  client.game = null;
  client.ui.auth ??= 'login';
  if (!session.booting) showLogin();
  throw new AuthError(String(error ?? 'Bitte einloggen.'));
}
