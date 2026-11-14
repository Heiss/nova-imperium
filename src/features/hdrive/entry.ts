import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 60;
export const leveled: Leveled = {
  cost: [10000, 20000, 6000],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 7,
    },
    r: {
      hyper: 3,
    },
  },
};
