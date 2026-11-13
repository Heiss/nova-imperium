import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 10;
export const unit: Unit = {
  cost: [2000, 2000, 0],
};
export const combat: Combat = {
  atk: 5,
  sh: 10,
};
export const def: ShipFields = {
  cargo: 5000,
  speed: 5000,
  fuel: 10,
  drive: 'comb',
  req: {
    b: {
      yard: 2,
    },
    r: {
      comb: 2,
    },
  },
};
