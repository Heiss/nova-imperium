import type { Leveled } from '../../core/components/leveled.ts';
import type { Placement } from '../../core/components/placement.ts';
import type { Storage } from '../../core/components/storage.ts';

export const kind = 'building';
export const order = 110;
export const leveled: Required<Leveled> = {
  cost: [1000, 0, 0],
  f: 2,
};
export const storage: Storage = { res: 'm' };
/** On planets and moons (#53; owner, 2026-11-13). */
export const placement: Placement = ['planet', 'moon'];
