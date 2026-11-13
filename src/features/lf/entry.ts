import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 40;
export const unit: Unit = {
  cost: [3000, 1000, 0],
};
export const combat: Combat = {
  atk: 50,
  sh: 10,
};
export const def: ShipFields = {
  cargo: 50,
  speed: 12500,
  fuel: 20,
  drive: 'comb',
  req: {
    b: {
      yard: 1,
    },
    r: {
      comb: 1,
    },
  },
};
