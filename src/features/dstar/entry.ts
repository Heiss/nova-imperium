// Issue #60, classic values (owner, 2026-11-12). Its 1,250 against the probe
// and the Solarsatellit replace the general 5 of rapid() in battle.ts. None
// against the Plasmawerfer and the shield domes (#50).

import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 110;
export const def: ShipFields = {
  cost: [5000000, 4000000, 1000000],
  atk: 200000,
  sh: 50000,
  cargo: 1000000,
  speed: 100,
  fuel: 1,
  drive: 'hdrive',
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
