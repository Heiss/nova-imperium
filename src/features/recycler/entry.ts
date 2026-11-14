// Issue #45, the classic Recycler (owner, 2026-11-13): always the
// Promethium-Brennkammer, no drive switch; the hull follows from the cost in
// the rule of `combat`, rapid fire 5 against the easy targets is the default.

import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Mobile } from '../../core/components/mobile.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 35;
export const unit: Unit = {
  cost: [10000, 6000, 2000],
};
export const combat: Combat = {
  atk: 1,
  sh: 10,
};
export const mobile: Mobile = {
  cargo: 20000,
  speed: 2000,
  fuel: 300,
  drive: 'comb',
};
export const def: ShipFields = {
  req: {
    b: {
      yard: 4,
    },
    r: {
      comb: 6,
      shield: 2,
    },
  },
};
