import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Mobile } from '../../core/components/mobile.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 70;
export const unit: Unit = {
  cost: [45000, 15000, 0],
};
export const combat: Combat = {
  atk: 1000,
  sh: 200,
};
export const mobile: Mobile = {
  cargo: 1500,
  speed: 10000,
  fuel: 500,
  drive: 'hdrive',
};
export const def: ShipFields = {
  req: {
    b: {
      yard: 7,
    },
    r: {
      hdrive: 4,
    },
  },
};
