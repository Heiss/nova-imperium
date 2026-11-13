import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 30;
export const unit: Unit = {
  cost: [10000, 20000, 10000],
};
export const combat: Combat = {
  atk: 50,
  sh: 100,
};
export const def: ShipFields = {
  cargo: 7500,
  speed: 2500,
  fuel: 1000,
  drive: 'impulse',
  req: {
    b: {
      yard: 4,
    },
    r: {
      impulse: 3,
    },
  },
};
