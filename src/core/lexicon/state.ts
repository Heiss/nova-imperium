// The state the search and the review list read the pages in: the universe
// and the round at their defaults and a player with nothing (#288). The
// pages themselves are computed from the state of the player (B5).
import { type RoundRules, storedValues } from '../round.ts';
import { DEFAULT_UNIVERSE } from '../universe.ts';
import type { LexState } from './types.ts';

/** The rules of a round with every setting at its default. */
export const defaultRound = (): RoundRules =>
  ({ number: 1, ...storedValues(() => undefined) }) as unknown as RoundRules;

/** The state of a new player in a new universe. */
export const defaultState = (): LexState => ({
  u: { ...DEFAULT_UNIVERSE },
  round: defaultRound(),
  research: {},
  ships: {},
});
