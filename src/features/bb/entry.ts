// Issue #57, classic before the update of 2019-12-13 (owner, 2026-11-12):
// Impulstriebwerk, from Hyperraumantrieb 8 the Hyperraumantrieb.

import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 100;
export const unit: Unit = {
  cost: [50000, 25000, 15000],
};
export const combat: Combat = {
  atk: 1000,
  sh: 500,
  rf: {
    rl: 20,
    ll: 20,
    hl: 10,
    ionc: 10,
  },
};
export const def: ShipFields = {
  cargo: 500,
  speed: 4000,
  fuel: 1000,
  drive: 'impulse',
  drives: [
    {
      drive: 'hdrive',
      speed: 5000,
      from: {
        research: 'hdrive',
        level: 8,
      },
    },
  ],
  req: {
    b: {
      yard: 8,
    },
    r: {
      impulse: 6,
      plasma: 5,
    },
  },
};
