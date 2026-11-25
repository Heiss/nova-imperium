// The state of the browser client (#118, okf/architecture/patterns.md,
// section 9): what src/client/main.ts kept in module variables, in one module
// with Svelte 5 runes. The views read it; their buttons send every game
// action through one act() (act.ts). Built so far: the state of the
// server, the view state, the clock offset and the completion notices; the
// rest moves with the other views.
import type { GameState } from './types.ts';
import type { Ui, V } from '../views/common.ts';

/** The interface state before the address and the storage of this device are read. */
export const newUi = (): Ui => ({
  view: 'overview',
  params: {},
  gal: 1,
  sys: 1,
  ft: null,
  gmoon: null,
  fm: 'attack',
  openRep: {},
  openEx: {},
  auth: null,
  invite: null,
  lastLink: null,
  animations: true,
  news: null,
  newsSeen: null,
});

class ClientState {
  /** The state of the server; null while signed out. */
  game = $state.raw<GameState | null>(null);
  /**
   * What the mounted views show: the view state of the last render, moved
   * on by the clock every second. Replaced as a whole, never changed in place.
   */
  shown = $state.raw<V | null>(null);
  /** The view state of the last render, moved to its time; completions compare with it. */
  view: V | null = null;
  /** The interface state: the view, the Sternenkarte, forms, open texts. */
  readonly ui: Ui = newUi();
  /** How far the clock of the server is ahead of this one, in milliseconds. */
  offset = 0;
  /** The last state of the server without its time: an unchanged one renders nothing. */
  lastKey = '';
  /** The notices above the view of what finished since the last render. */
  readonly completionNotices = new Set<string>();
  /** The menu entries that show a finished upgrade, order or flight, by view. */
  readonly completedMenu = new Map<string, string>();

  /** The time of the server. */
  now(): number {
    return Date.now() + this.offset;
  }

  /** Forgets what belonged to the planet, player or round shown before. */
  forget(): void {
    this.completedMenu.clear();
    this.completionNotices.clear();
    this.view = null;
  }
}

/** The one state of the client. */
export const client = new ClientState();
