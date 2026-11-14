// Issue #53, the classic Mondbasis as the Mondzitadelle (owner, 2026-11-13):
// 20,000 Adamant, 40,000 Psikristall, 20,000 Promethium, factor 2, no
// requirement; every level adds 3 fields to its moon and takes one itself;
// it stands on moons only (owner, 2026-11-14). There is no way to tear a
// building down, so it cannot be torn down either.
import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Placement } from '../../core/components/placement.ts';

export const kind = 'building';
export const order = 140;
export const leveled: Required<Leveled> = {
  cost: [20000, 40000, 20000],
  f: 2,
};
export const placement: Placement = ['moon'];
export const def: BuildingFields = {
  fields: 3,
};
