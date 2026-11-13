// Issue #59. Not in version 1; the classic values (owner, 2026-11-12).
// Every ship has rapid fire 5 against the probe (`easy`, components/combat.ts).

import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 90;
export const unit: Unit = {
  cost: [60000, 50000, 15000],
};
export const combat: Combat = {
  atk: 2000,
  sh: 500,
  rf: {
    ll: 10,
    bc: 2,
  },
};
export const def: ShipFields = {
  cargo: 2000,
  speed: 5000,
  fuel: 1000,
  drive: 'hdrive',
  req: {
    b: {
      yard: 9,
    },
    r: {
      hdrive: 6,
      hyper: 5,
    },
  },
};
