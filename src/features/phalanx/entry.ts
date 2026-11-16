// Issue #53, the classic Sensorphalanx as the Auspex-Phalanx (owner,
// 2026-11-13 and 2026-11-15, okf/features/moons.md): 20,000 Adamant, 40,000
// Psikristall, 20,000 Promethium, factor 2; it needs Mondzitadelle 1 and
// stands on moons only; it comes after the Mondzitadelle. Its range and its
// scan are the rules of src/core/phalanx.ts.
import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Placement } from '../../core/components/placement.ts';

export const kind = 'building';
export const order = 150;
export const leveled: Required<Leveled> = {
  cost: [20000, 40000, 20000],
  f: 2,
};
export const placement: Placement = ['moon'];
export const def: BuildingFields = {
  req: { b: { moonbase: 1 } },
};
