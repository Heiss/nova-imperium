// The one way of the client to send a game action (#118, okf/architecture/
// patterns.md, section 9): every button of the views ends here.
import type { GameState } from './types.ts';

/** The player and the planet a state shows. */
export interface Place {
  player?: string;
  planet?: string;
}

export const placeOf = (s: GameState | null): Place => ({
  player: s?.me.id,
  planet: s?.planet?.id,
});

/** Whether the state still shows the player and planet of `before`. */
export const samePlace = (s: GameState | null, before: Place): boolean =>
  !!s && s.me.id === before.player && s.planet?.id === before.planet;

export interface ActDeps {
  api: (url: string, body: unknown) => Promise<Record<string, unknown>>;
  /** The state the client shows now. */
  state: () => GameState | null;
  apply: (state: GameState) => void;
  toast: (msg: string, err?: boolean) => void;
}

/**
 * What an action came to: `done` on the planet still shown, `stale` when it
 * went through but the player left that planet meanwhile (its form must
 * stay, review of #209), `failed` when the server refused it.
 */
type ActResult = 'done' | 'stale' | 'failed';

export interface Sync {
  /** Sends an action for the shown planet; its answer is applied only there. */
  send: (type: string, data?: object) => Promise<ActResult>;
  /**
   * Starts a refresh and answers whether its state may still be applied:
   * only for the newest refresh, and only when no action was on its way or
   * started since it began, so a refresh never undoes the answer of an
   * action with an older state (review of #209).
   */
  refresh: () => () => boolean;
}

export function createAct(deps: ActDeps): Sync {
  // A new token per started action and per started refresh: only identity
  // counts. `running` counts the actions on their way.
  let lastAction: object = {};
  let lastRefresh: object = {};
  let running = 0;
  const send: Sync['send'] = async (type, data = {}) => {
    lastAction = {};
    running++;
    try {
      const before = placeOf(deps.state());
      const j = await deps.api('/api/action', {
        type,
        planet: before.planet,
        ...data,
      });
      const here = samePlace(deps.state(), before);
      if (here) deps.apply(j.state as GameState);
      if (j.msg) deps.toast(String(j.msg));
      return here ? 'done' : 'stale';
    } catch (e) {
      deps.toast((e as Error).message, true);
      return 'failed';
    } finally {
      running--;
    }
  };
  const refresh: Sync['refresh'] = () => {
    const ticket = {};
    lastRefresh = ticket;
    const at = lastAction;
    const idle = running === 0;
    return () => idle && ticket === lastRefresh && at === lastAction;
  };
  return { send, refresh };
}
