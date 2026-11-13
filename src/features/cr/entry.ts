import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 60;
export const def: ShipFields = {
  cost: [20000, 7000, 2000],
  atk: 400,
  sh: 50,
  cargo: 800,
  speed: 15000,
  fuel: 300,
  drive: 'impulse',
  req: {
    b: {
      yard: 5,
    },
    r: {
      impulse: 4,
      laser: 4,
    },
  },
  rf: {
    lf: 6,
    rl: 10,
  },
};
