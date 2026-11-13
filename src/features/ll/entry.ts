import type { DefenseFields } from '../../core/catalog.ts';

export const kind = 'defense';
export const order = 20;
export const def: DefenseFields = {
  cost: [1500, 500, 0],
  atk: 100,
  sh: 25,
  req: {
    b: {
      yard: 2,
    },
    r: {
      energy: 1,
      laser: 3,
    },
  },
};
