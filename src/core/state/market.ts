// The key of the marketplace in the state (#171, #317).
import type { Pair } from '../market.ts';

export type StateShape = {
  /** The prices of the marketplace now and what the player gave today (#171). */
  market: { prices: Record<Pair, number>; used: number };
};
