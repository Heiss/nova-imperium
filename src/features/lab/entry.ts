import type { Leveled } from '../../core/components/leveled.ts';
import type { Locks } from '../../core/components/locks.ts';

export const kind = 'building';
export const order = 100;
export const leveled: Required<Leveled> = {
  cost: [200, 400, 200],
  f: 2,
};
/** An upgrade stops the research, and waits until none runs (#49, #183). */
export const locks: Locks = { stops: 'research', home: true };
