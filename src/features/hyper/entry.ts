import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 50;
export const leveled: Leveled = {
  cost: [0, 4000, 2000],
};
export const def: ResearchFields = {
  req: {
    b: {
      lab: 7,
    },
    r: {
      energy: 5,
      shield: 5,
    },
  },
};
