// The key of the locked positions in the state (#224, #317).
import type { Coords } from '../types.ts';

export type StateShape = {
  /** The positions locked after an abandonment, with the end of the lock (#224). */
  locks: (Coords & { until: number })[];
};
