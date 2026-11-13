import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 70;
export const leveled: Leveled = {
  cost: [200, 1000, 200],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 3,
    },
  },
};
