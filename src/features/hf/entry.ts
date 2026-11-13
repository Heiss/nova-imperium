import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 50;
export const def: ShipFields = {
  cost: [6000, 4000, 0],
  atk: 150,
  sh: 25,
  cargo: 100,
  speed: 10000,
  fuel: 75,
  drive: 'impulse',
  req: {
    b: {
      yard: 3,
    },
    r: {
      armor: 2,
      impulse: 2,
    },
  },
  rf: {
    sc: 3,
  },
};
