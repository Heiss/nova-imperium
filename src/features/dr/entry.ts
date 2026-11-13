// Issue #59. Not in version 1; the classic values (owner, 2026-11-12).
// Every ship has rapid fire 5 against the probe (battle.ts).

import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 90;
export const def: ShipFields = {
  cost: [60000, 50000, 15000],
  atk: 2000,
  sh: 500,
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
  rf: {
    ll: 10,
    bc: 2,
  },
};
