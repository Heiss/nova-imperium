import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'building';
export const order = 100;
export const leveled: Required<Leveled> = {
  cost: [200, 400, 200],
  f: 2,
};
