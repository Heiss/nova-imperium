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
 * Sends an action for the shown planet; its answer is applied only while
 * the player still looks at that planet. Answers whether it succeeded.
 */
export function createAct(
  deps: ActDeps,
): (type: string, data?: object) => Promise<boolean> {
  return async (type, data = {}) => {
    try {
      const before = placeOf(deps.state());
      const j = await deps.api('/api/action', {
        type,
        planet: before.planet,
        ...data,
      });
      if (samePlace(deps.state(), before)) deps.apply(j.state as GameState);
      if (j.msg) deps.toast(String(j.msg));
      return true;
    } catch (e) {
      deps.toast((e as Error).message, true);
      return false;
    }
  };
}
