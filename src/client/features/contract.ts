// The contract of a client feature (okf/architecture/patterns.md, section 13;
// #322, part 1 of #317). A feature adds its `data-act` handlers in a file of
// its own in this folder and exports it as `clientFeature`; the list of all of
// them is generated (scripts/gen-features.ts), so src/client/main.ts names no
// feature and a new one edits no shared place.
import type { Planet } from '../../core/types.ts';
import type { FleetForm } from '../logic/game.ts';

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
  act: (type: string, data?: object) => Promise<boolean>;
  /** Sends an action; true when it went through on the place still shown. */
  actHere: (type: string, data?: object) => Promise<boolean>;
  /** Shows the HTML in the dialog; the empty string closes it. */
  modal: (html: string) => void;
  /** Shows a view with its address and renders it. */
  go: (view: string, push?: boolean, guild?: string | null) => void;
  /** Renders the shown view again; `fresh` drops the typed drafts. */
  render: (fresh?: boolean) => void;
  /** Sets the value of an input, when it is there. */
  setInput: (sel: string, v: string | number) => void;
  /** What the fleet form needs, until the fleet form leaves main.ts. */
  fleet: {
    /** Updates the preview of the fleet form. */
    calc: () => void;
    /** The fleet form as it is filled in. */
    form: () => FleetForm;
    /** The shown planet with its stock of this moment. */
    planet: () => Planet;
  };
}

/** What a client feature exports as `clientFeature`. */
export interface ClientFeature {
  /** The `data-act` handlers of the feature, by name. */
  acts: (ctx: ClientCtx) => Record<string, Handler>;
}
