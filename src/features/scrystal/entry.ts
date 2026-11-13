import type { Leveled } from '../../core/components/leveled.ts';
import type { Storage } from '../../core/components/storage.ts';

export const kind = 'building';
export const order = 120;
export const leveled: Required<Leveled> = {
  cost: [1000, 500, 0],
  f: 2,
};
export const storage: Storage = { res: 'c' };
