import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 100;
export const leveled: Leveled = {
  cost: [200, 600, 0],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 6,
    },
    r: {
      energy: 3,
    },
  },
};
