// What a part of the seed command gets and what it exports (#324). The frame
// `e2e/seed.ts` loads every file of `e2e/seed/`, runs the parts by `order` in
// one transaction and refuses a field that no part lists.
import type { Store } from '../../../src/server/db/store.ts';

export type Planet = NonNullable<ReturnType<Store['planetOfUser']>>;
type User = NonNullable<ReturnType<Store['userByName']>>;

/** The JSON of the call: `name` and the fields of the parts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeedData = Record<string, any>;

export interface Seed {
  store: Store;
  d: SeedData;
  user: User;
  /** The home planet as the call found it (after `home` moved it). */
  planet: Planet;
  /**
   * The home planet being changed: the parts with an `order` below
   * `HOME_SAVED_AT` change it, the frame saves it once after them.
   */
  home: Planet;
}

export interface SeedPart {
  order: number;
  /** The fields of the JSON this part handles. */
  fields: readonly string[];
  apply: (s: Seed) => void;
}

/** The frame saves the home planet before the parts from this order on. */
export const HOME_SAVED_AT = 50;
