// What the steps of the login remember from one screen to the next (#118,
// bundle 7; formerly module variables of main.ts): whether the player wants
// to stay logged in on this device, and the token of the link „Passwort
// vergessen“ while the new password is set. The sign-in by mail code is kept
// by the server in an HttpOnly cookie, not here (129a, #401). The steps are in features/login.ts; main.ts reads `resetToken` (a
// state that arrives while the new password is set is not taken over) and
// sets it when it opens such a link.
import type { Ui } from '../views/common.ts';
import type { GameState } from './types.ts';

export const login: {
  remember: boolean;
  resetToken: string | null;
} = { remember: false, resetToken: null };

/** The Sternenkarte opens at the home system of the player who has just signed in. */
export function homeSystem(
  ui: Pick<Ui, 'gal' | 'sys'>,
  game: Pick<GameState, 'planet'> | null,
): void {
  if (game?.planet) {
    ui.gal = game.planet.g;
    ui.sys = game.planet.s;
  }
}
