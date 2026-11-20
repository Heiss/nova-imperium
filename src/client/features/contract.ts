// The contract of a client feature (okf/architecture/patterns.md, section 13;
// #322, part 1 of #317). A feature adds its `data-act` handlers in a file of
// its own in this folder and exports it as `clientFeature`; the list of all of
// them is generated (scripts/gen-features.ts), so src/client/main.ts names no
// feature and a new one edits no shared place.
import type { ActionArgs, ActionName } from '../../core/actions.ts';
import type { GameState } from '../logic/types.ts';
import type { Dialog } from '../modal.ts';

/** The data attributes of the element a handler was called for. */
export type Data = Record<string, string | undefined>;

/** A handler of a `data-act` name; a promise it returns is not awaited. */
export type Handler = (d: Data) => unknown;

/**
 * What a feature needs from main.ts. Only what moved code really uses is
 * here; the state is the module `logic/state.svelte.ts`, which a feature
 * imports itself.
 */
export interface ClientCtx {
  /** Sends an action; true when it went through, wherever the player is now. */
  act: <K extends ActionName>(
    type: K,
    ...data: ActionArgs<K>
  ) => Promise<boolean>;
  /** Sends an action; true when it went through on the place still shown. */
  actHere: <K extends ActionName>(
    type: K,
    ...data: ActionArgs<K>
  ) => Promise<boolean>;
  /** Sends an action the client starts by itself; a refusal is no message (#301). */
  quiet: <K extends ActionName>(
    type: K,
    ...data: ActionArgs<K>
  ) => Promise<boolean>;
  /** Shows the HTML or the component in the dialog; the empty string closes it. */
  modal: (content: string | Dialog) => void;
  /** Shows a view with its address and renders it. */
  go: (view: string, push?: boolean, guild?: string | null) => void;
  /** Renders the shown view again; `fresh` drops the typed drafts. */
  render: (fresh?: boolean) => void;
  /** Calls the server; a refusal throws an error with the server's words. */
  api: (url: string, body?: unknown) => Promise<Record<string, unknown>>;
  /** Shows a note that goes away by itself; `err` for a refusal. */
  toast: (msg: string, err?: boolean) => void;
  /** Sets the value of an input, when it is there. */
  setInput: (sel: string, v: string | number) => void;
  /** Takes over the state an answer of the server brought; the views render when it changed, or at once when `fresh`. */
  apply: (state: GameState, fresh?: boolean) => void;
  /** The session is gone: back to the login, then stops the caller with an error. */
  signedOut: (error: unknown) => never;
}

/** What a client feature exports as `clientFeature`. */
export interface ClientFeature {
  /** The `data-act` handlers of the feature, by name. */
  acts: (ctx: ClientCtx) => Record<string, Handler>;
  /**
   * The handlers of the forms of the feature by the id of the form; the
   * submit is stopped, then the handler runs. A form that clears itself
   * with its own listener (abandon, market, social) needs none.
   */
  forms?: (ctx: ClientCtx) => Record<string, () => unknown>;
  /** Runs after each render, once the view is on the page. */
  afterRender?: () => void;
}
