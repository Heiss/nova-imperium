import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 30;
export const unit: Unit = {
  cost: [6000, 2000, 0],
};
export const combat: Combat = {
  atk: 250,
  sh: 100,
};
export const def: DefenseFields = {
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
