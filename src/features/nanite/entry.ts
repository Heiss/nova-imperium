// Issue #48. Not in version 1; the classic values (owner, 2026-11-11).

import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Locks } from '../../core/components/locks.ts';

export const kind = 'building';
export const order = 70;
export const leveled: Required<Leveled> = {
  cost: [1000000, 500000, 100000],
  f: 2,
};
export const def: BuildingFields = {
  req: {
    b: {
      robot: 10,
    },
    r: {
      computer: 10,
    },
  },
};
/** An upgrade stops the shipyard too, and waits until it has no orders (#48 D1, #183). */
export const locks: Locks = { stops: 'shipyard' };
