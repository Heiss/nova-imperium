import type { DefenseFields } from '../../core/catalog.ts';

export const kind = 'defense';
export const order = 10;
export const def: DefenseFields = {
  cost: [2000, 0, 0],
  atk: 80,
  sh: 20,
  req: {
    b: {
      yard: 1,
    },
  },
};
