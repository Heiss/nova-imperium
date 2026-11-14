import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Mobile } from '../../core/components/mobile.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 60;
export const unit: Unit = {
  cost: [20000, 7000, 2000],
};
export const combat: Combat = {
  atk: 400,
  sh: 50,
  rf: {
    lf: 6,
    rl: 10,
  },
};
export const mobile: Mobile = {
  cargo: 800,
  speed: 15000,
  fuel: 300,
  drive: 'impulse',
};
export const def: ShipFields = {
  req: {
    b: {
      yard: 5,
    },
    r: {
      impulse: 4,
      laser: 4,
    },
  },
};
