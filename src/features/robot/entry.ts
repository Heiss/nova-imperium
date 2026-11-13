import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'building';
export const order = 60;
export const leveled: Required<Leveled> = {
  cost: [400, 120, 200],
  f: 2,
};
