// Kolonialverwaltung (#237, owner, 2026-11-17, D2: a research of its own; its
// cost and requirements are [V], the builder's proposal for the owner to
// confirm): the same cost and requirements as the Kreuzzugs-Kartografie.
// Only a round with the colony research has it (src/core/colony-limit.ts):
// each level raises the limit of planets by the round's planets per level.
import type { ResearchFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';

export const kind = 'research';
export const order = 180;
export const leveled: Leveled = {
  cost: [4000, 8000, 4000],
};
export const def: ResearchFields = {
  req: {
    r: {
      spy: 4,
      impulse: 3,
    },
    b: {
      lab: 3,
    },
  },
};
