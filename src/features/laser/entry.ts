import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 20;
export const leveled: Leveled = {
  cost: [200, 100, 0],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 1,
    },
    r: {
      energy: 2,
    },
  },
};
