import type { ShipFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Unit } from '../../core/components/unit.ts';
import type { Produces } from '../../core/components/produces.ts';
import { satsEnergy } from '../../core/rates.ts';

export const kind = 'ship';
export const order = 130;
// Its level is the number of satellites on the planet (#46).
export const produces: Produces = {
  order: 50,
  e: (x) => satsEnergy(x.level, x.temp, x.pct),
};
export const unit: Unit = {
  cost: [0, 2000, 500],
};
export const combat: Combat = {
  atk: 1,
  sh: 1,
  easy: true,
};
// No `mobile`: it stays at its planet (owner, 2026-11-14).
export const def: ShipFields = {
  req: {
    b: {
      yard: 1,
    },
  },
};
