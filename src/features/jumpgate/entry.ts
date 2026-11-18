// Issues #53 and #230, the classic Sprungtor as the Warp-Tor with modern
// levels (owner, 2026-11-13, okf/features/moons.md): level 1 costs
// 2,000,000 Adamant, 4,000,000 Psikristall, 2,000,000 Promethium, factor 2;
// it needs Mondzitadelle 1 and Warp-Theorie 7 and stands on moons only; it
// comes after the Auspex-Phalanx. The jump and its cooldown are the rules of
// src/core/jump-gate.ts.
import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Placement } from '../../core/components/placement.ts';

export const kind = 'building';
export const order = 160;
export const leveled: Required<Leveled> = {
  cost: [2000000, 4000000, 2000000],
  f: 2,
};
export const placement: Placement = ['moon'];
export const def: BuildingFields = {
  req: { b: { moonbase: 1 }, r: { hyper: 7 } },
};
