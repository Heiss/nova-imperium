import type { DefenseFields } from '../../core/catalog.ts';

export const kind = 'defense';
export const order = 30;
export const def: DefenseFields = {
  cost: [6000, 2000, 0],
  atk: 250,
  sh: 100,
  req: {
    b: {
      yard: 4,
    },
    r: {
      energy: 3,
      laser: 6,
    },
  },
};
