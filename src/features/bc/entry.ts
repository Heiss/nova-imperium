// Issue #58. Not in version 1; the classic values (owner, 2026-11-12).
// Every ship has rapid fire 5 against the probe (`easy`, components/combat.ts).

import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 80;
export const unit: Unit = {
  cost: [30000, 40000, 15000],
};
export const combat: Combat = {
  atk: 700,
  sh: 400,
  rf: {
    sc: 3,
    lc: 3,
    hf: 4,
    cr: 4,
    bs: 7,
  },
};
export const def: ShipFields = {
  cargo: 750,
  speed: 10000,
  fuel: 250,
  drive: 'hdrive',
  req: {
    b: {
      yard: 8,
    },
    r: {
      laser: 12,
      hyper: 5,
      hdrive: 5,
    },
  },
};
