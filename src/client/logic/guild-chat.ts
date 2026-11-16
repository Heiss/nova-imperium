// The guild chat in the browser (#169): what the client still does once an
// answer of the server is in (CodeRabbit on #216).
import type { GameState } from './types.ts';

/**
 * Whether the answer of „Chat lesen“ may still open the chat: only while the
 * admin who asked is signed in, not after a logout or with another account
 * signed in meanwhile, so a guild chat never opens on the login screen or for
 * someone else.
 */
export const sameSignIn = (
  s: GameState | null,
  player: string | undefined,
): boolean => player !== undefined && s?.me.id === player;

/**
 * Whether the text field may be emptied after a message went through: only
 * while it still holds the sent text, so a draft typed while the message was
 * on its way stays, and a field that is gone gets no focus.
 */
export const clearsChat = (sent: string, now: string | undefined): boolean =>
  now === sent;
