import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 20;
export const unit: Unit = {
  cost: [1500, 500, 0],
};
export const combat: Combat = {
  atk: 100,
  sh: 25,
};
export const def: DefenseFields = {
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
