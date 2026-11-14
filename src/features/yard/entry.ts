import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Placement } from '../../core/components/placement.ts';

export const kind = 'building';
export const order = 90;
export const leveled: Required<Leveled> = {
  cost: [400, 200, 100],
  f: 2,
};
export const def: BuildingFields = {
  req: {
    b: {
      robot: 2,
    },
  },
};
/** On planets and moons (#53; owner, 2026-11-13). */
export const placement: Placement = ['planet', 'moon'];
