import type { DefenseFields } from '../../core/catalog.ts';

export const kind = 'defense';
export const order = 40;
export const def: DefenseFields = {
  cost: [20000, 15000, 2000],
  atk: 1100,
  sh: 200,
  req: {
    b: {
      yard: 6,
    },
    r: {
      energy: 6,
      weapons: 3,
      shield: 1,
    },
  },
};
