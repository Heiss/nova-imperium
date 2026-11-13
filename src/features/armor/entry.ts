import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 110;
export const leveled: Leveled = {
  cost: [1000, 0, 0],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 2,
    },
  },
};
