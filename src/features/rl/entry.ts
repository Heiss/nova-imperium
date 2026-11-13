import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 10;
export const unit: Unit = {
  cost: [2000, 0, 0],
};
export const combat: Combat = {
  atk: 80,
  sh: 20,
};
export const def: DefenseFields = {
  req: {
    b: {
      yard: 1,
    },
  },
};
