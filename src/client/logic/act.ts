// The one way of the client to send a game action (#118, okf/architecture/
// patterns.md, section 9): every button of the views ends here.
import type { ActionArgs, ActionName } from '../../core/actions.ts';
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
  /** `err`: true for an error message, or the error itself (its call is named). */
  toast: (msg: string, err?: boolean | Error) => void;
  /** Fields every action's request carries besides its own: the open conversation of the private messages (Q32). */
  extra?: () => object;
  /**
   * The data an action answers besides its state (the scan of the
   * Auspex-Phalanx, #53); given before the state, on the planet still shown,
   * and only for the newest action of its type: the answer of a scan that a
   * newer scan overtook is dropped (review of #217).
   */
  answer?: (data: Record<string, unknown>) => void;
}

/**
 * What an action came to: `done` on the planet still shown, `stale` when it
 * went through but the player left that planet meanwhile (its form must
 * stay, review of #209), `failed` when the server refused it.
 */
type ActResult = 'done' | 'stale' | 'failed';

export interface Sync {
  /** Sends an action for the shown planet; its answer is applied only there. */
  send: <K extends ActionName>(
    type: K,
    ...data: ActionArgs<K>
  ) => Promise<ActResult>;
  /**
   * Sends an action the client starts by itself (the chat was seen, #169).
   * The server may refuse it when the player lost a right meanwhile; that
   * refusal is no message for the player (#301).
   */
  quiet: <K extends ActionName>(
    type: K,
    ...data: ActionArgs<K>
  ) => Promise<ActResult>;
  /**
   * Starts a refresh and answers whether its state may still be applied:
   * only for the newest refresh, and only when no action was on its way or
   * started since it began, so a refresh never undoes the answer of an
   * action with an older state (review of #209).
   */
  refresh: () => () => boolean;
}

/** The data of an answer besides its state, or null when it has none. */
const dataOf = (j: Record<string, unknown>): Record<string, unknown> | null =>
  // `typeof null` is 'object' too: then the data are null as well.
  typeof j.data === 'object'
    ? (j.data as Record<string, unknown> | null)
    : null;

export function createAct(deps: ActDeps): Sync {
  // A new token per started action and per started refresh: only identity
  // counts. `running` counts the actions on their way, `lastOfType` holds
  // the token of the newest action of each type.
  let lastAction: object = {};
  let lastRefresh: object = {};
  const lastOfType = new Map<string, object>();
  let running = 0;
  const run = async (
    type: string,
    data: object,
    refused: (error: Error) => void,
  ): Promise<ActResult> => {
    const ticket = {};
    lastAction = ticket;
    lastOfType.set(type, ticket);
    running++;
    try {
      const before = placeOf(deps.state());
      const j = await deps.api('/api/action', {
        type,
        planet: before.planet,
        ...deps.extra?.(),
        ...data,
      });
      const here = samePlace(deps.state(), before);
      const extra = dataOf(j);
      if (here && extra && lastOfType.get(type) === ticket)
        deps.answer?.(extra);
      if (here) deps.apply(j.state as GameState);
      if (j.msg) deps.toast(String(j.msg));
      return here ? 'done' : 'stale';
    } catch (e) {
      refused(e as Error);
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
  const send: Sync['send'] = (type, ...[data]) =>
    run(type, data ?? {}, (error) => deps.toast(error.message, error));
  const quiet: Sync['quiet'] = (type, ...[data]) =>
    run(type, data ?? {}, () => {});
  return { send, quiet, refresh };
}
