// The contract of a server feature (okf/architecture/patterns.md, section 14;
// #326, part 2 of #317). A server module that adds actions or a part of the
// state exports it under the fixed name `serverFeature`; the list of all of
// them is generated (scripts/gen-features.ts, src/server/features.gen.ts), so
// dispatch.ts and state.ts name no feature and a new one edits no shared place.
import type { ActivityLimits } from '../../core/activity.ts';
import type { Main } from '../../core/main-planet.ts';
import type { RoundRules } from '../../core/round.ts';
import type { Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { Action } from './actions.ts';
import type { Ctx } from './context.ts';

/** What `stateFor` works out once for all parts of the state. */
export interface StateView {
  round: RoundRules;
  /** The main planet of the player and the end of the lock of the last switch (#221). */
  main: Main<Planet>;
  /** The shown planet: the selected own planet, else the main planet. */
  planet: Planet | null;
  /** The points of every player. */
  pts: Readonly<Record<string, number>>;
  limits: ActivityLimits;
}

/** The place and the content of some keys of the state a player gets. */
export interface StatePart {
  /**
   * The place of the keys in the JSON object: parts run by ascending number,
   * so the order of the keys does not depend on a list. A number is used once
   * (a new part takes the next free ten above the highest).
   */
  order: number;
  /** The keys `build` returns, so a key defined twice is found at the start. */
  keys: readonly string[];
  /** The value of each key of `keys`, for the player `u`. */
  build: (ctx: Ctx, u: User, view: StateView) => Record<string, unknown>;
}

/** What a server module exports as `serverFeature`; every member is optional. */
export interface ServerFeature {
  /** The actions of the feature by name. */
  actions?: Record<string, Action>;
  /** The actions refused while guilds are off in the round (#191). */
  guildActions?: Record<string, Action>;
  /** The actions of the admin: audited as `admin.write`, not as `game`. */
  adminActions?: Record<string, Action>;
  /** The keys the feature adds to the state. */
  state?: StatePart;
}
