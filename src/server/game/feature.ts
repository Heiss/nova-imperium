// The contract of a server feature (okf/architecture/patterns.md, section 14;
// #326, part 2 of #317). A server module that adds actions or a part of the
// state exports it under the fixed name `serverFeature`; the list of all of
// them is generated (scripts/gen-features.ts, src/server/features.gen.ts), so
// dispatch.ts and state.ts name no feature and a new one edits no shared place.
import type { ActivityLimits } from '../../core/activity.ts';
import type { PmOpen } from '../../core/private-messages.ts';
import type { Main } from '../../core/main-planet.ts';
import type { RoundRules } from '../../core/round.ts';
import type { Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { ActionName } from '../../core/actions.ts';
import type { Handler } from './actions.ts';
import type { Ctx } from './context.ts';
import type { ShownSystem } from '../../core/galaxy-shown.ts';
import type { ScorePass } from './scores.ts';

/** What `stateFor` works out once for all parts of the state. */
export interface StateView {
  round: RoundRules;
  /** The main planet of the player and the end of the lock of the last switch (#221). */
  main: Main<Planet>;
  /** The shown planet: the selected own planet, else the main planet. */
  planet: Planet | null;
  /** The points of every player: the total of `scores`. */
  pts: Readonly<Record<string, number>>;
  /**
   * The pass of the points and categories this state is built from (#405):
   * read once, so the total, the categories and „Stand“ are of one pass.
   */
  scores: ScorePass;
  limits: ActivityLimits;
  /** The conversation of the private messages the browser has open (Q32), if it names one. */
  pmOpen?: PmOpen;
  /** The system the Sternenkarte shows, when the request names one (151a). */
  shown?: ShownSystem | null;
}

/**
 * The place and the content of some keys of the state a player gets. `S` is
 * the shape of the part (`src/core/state/<part>.ts`, #317): `build` returns
 * it, so the compiler checks what is sent against the type the browser reads.
 */
export interface StatePart<
  S extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * The place of the keys in the JSON object: parts run by ascending number,
   * so the order of the keys does not depend on a list. A number is used once
   * (a new part takes the next free ten above the highest).
   */
  order: number;
  /** The keys `build` returns, so a key defined twice is found at the start. */
  keys: readonly (keyof S & string)[];
  /** The value of each key of `keys`, for the player `u`. */
  build: (ctx: Ctx, u: User, view: StateView) => S;
}

/**
 * The actions of a group by name: a name the map of `src/core/actions/` does
 * not know is refused by the compiler, and so is a handler whose input is not
 * the one of the map (#317).
 */
export type Handlers = { readonly [K in ActionName]?: Handler<K> };

/** What a server module exports as `serverFeature`; every member is optional. */
export interface ServerFeature {
  /** The actions of the feature by name. */
  actions?: Handlers;
  /** The actions of the admin: audited as `admin.write`, not as `game`. */
  adminActions?: Handlers;
  /** The keys the feature adds to the state. */
  state?: StatePart;
  /**
   * Whether the feature is on in the round (default: always; #374). While it
   * is off, each of its `actions` is refused with `off` and every key of its
   * `state` is null.
   */
  enabled?: (round: RoundRules) => boolean;
  /** The refusal of its actions while the feature is off; required with `enabled`. */
  off?: string;
}

/** The switch of the actions of a feature that can be off (#374). */
export interface Gate {
  enabled: (round: RoundRules) => boolean;
  off: string;
}
