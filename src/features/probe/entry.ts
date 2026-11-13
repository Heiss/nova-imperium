import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 120;
export const unit: Unit = {
  cost: [0, 1000, 0],
};
export const combat: Combat = {
  atk: 0.01,
  sh: 0.01,
  easy: true,
};
export const def: ShipFields = {
  cargo: 0,
  speed: 100000000,
  fuel: 1,
  drive: 'comb',
  req: {
    b: {
      yard: 3,
    },
    r: {
      comb: 3,
      spy: 2,
    },
  },
};
