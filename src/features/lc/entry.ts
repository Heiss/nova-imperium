import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Mobile } from '../../core/components/mobile.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 20;
export const unit: Unit = {
  cost: [6000, 6000, 0],
};
export const combat: Combat = {
  atk: 5,
  sh: 25,
};
export const mobile: Mobile = {
  cargo: 25000,
  speed: 7500,
  fuel: 50,
  drive: 'comb',
};
export const def: ShipFields = {
  req: {
    b: {
      yard: 4,
    },
    r: {
      comb: 6,
    },
  },
};
