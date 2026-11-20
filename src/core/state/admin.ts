// The key of the admin in the state (#161, #237, #317).
import type { UniverseSpec } from '../universe.ts';

export interface AdminState {
  specs: readonly UniverseSpec[];
  /** The „Endzeit“ (#161): the saved flight time and whether it is used up this round. */
  endzeit: { minutes: number; done: boolean };
  /** What a new round starts with where the running round has no value of its own (#237), by name. */
  fresh: Record<string, number>;
}

export type StateShape = {
  /** Only for the admin. */
  admin: AdminState | null;
};
