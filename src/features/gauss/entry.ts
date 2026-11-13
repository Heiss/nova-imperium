import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 40;
export const unit: Unit = {
  cost: [20000, 15000, 2000],
};
export const combat: Combat = {
  atk: 1100,
  sh: 200,
};
export const def: DefenseFields = {
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
