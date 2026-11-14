import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Mobile } from '../../core/components/mobile.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 50;
export const unit: Unit = {
  cost: [6000, 4000, 0],
};
export const combat: Combat = {
  atk: 150,
  sh: 25,
  rf: {
    sc: 3,
  },
};
export const mobile: Mobile = {
  cargo: 100,
  speed: 10000,
  fuel: 75,
  drive: 'impulse',
};
export const def: ShipFields = {
  req: {
    b: {
      yard: 3,
    },
    r: {
      armor: 2,
      impulse: 2,
    },
  },
};
