import type { Leveled } from '../../core/components/leveled.ts';
import type { Placement } from '../../core/components/placement.ts';

export const kind = 'building';
export const order = 60;
export const leveled: Required<Leveled> = {
  cost: [400, 120, 200],
  f: 2,
};
/** On planets and moons (#53; owner, 2026-11-13). */
export const placement: Placement = ['planet', 'moon'];
