import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 40;
export const leveled: Leveled = {
  cost: [2000, 4000, 600],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 2,
    },
    r: {
      energy: 1,
    },
  },
};
