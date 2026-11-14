// Issue #60, classic values (owner, 2026-11-12). Its 1,250 against the probe
// and the Solarsatellit replace the general 5 against an easy target
// (components/combat.ts). None against the Plasmawerfer and the shield domes
// (#50).

import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Mobile } from '../../core/components/mobile.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'ship';
export const order = 110;
export const unit: Unit = {
  cost: [5000000, 4000000, 1000000],
};
export const combat: Combat = {
  atk: 200000,
  sh: 50000,
  rf: {
    probe: 1250,
    sat: 1250,
    colony: 250,
    sc: 250,
    lc: 250,
    lf: 200,
    hf: 100,
    cr: 33,
    bs: 30,
    bb: 25,
    bc: 15,
    dr: 5,
    rl: 200,
    ll: 200,
    hl: 100,
    gauss: 50,
    ionc: 100,
  },
};
export const mobile: Mobile = {
  cargo: 1000000,
  speed: 100,
  fuel: 1,
  drive: 'hdrive',
};
export const def: ShipFields = {
  req: {
    b: {
      yard: 12,
    },
    r: {
      hyper: 6,
      hdrive: 7,
      graviton: 1,
    },
  },
};
