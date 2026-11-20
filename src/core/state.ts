// The state the server sends a player (GET /api/state), derived from the
// shapes of its parts (#317): every file of src/core/state/ declares the keys
// one part holds and their types (the list is generated, scripts/
// gen-features.ts); the server checks what each part builds against its
// shape, and the browser's `GameState` is this type, not a second one written
// by hand.
import type { FullState } from './state.gen.ts';

/** The keys of the lock screen of the vacation mode (#223): the rest of the state is not sent. */
type LockedKeys =
  | 'round'
  | 'now'
  | 'cfg'
  | 'me'
  | 'planet'
  | 'labs'
  | 'fleets'
  | 'reports'
  | 'players'
  | 'galaxy'
  | 'debris'
  | 'admin';

/** What a player in vacation mode gets (`lockedState` of the server). */
export type LockedState = Pick<FullState, LockedKeys>;

/** What the browser holds: the keys of the lock screen always, every other key of a feature only outside the vacation mode. */
export type GameState = LockedState & Partial<Omit<FullState, LockedKeys>>;
