// Issue #54, the classic Raketensilo as the Raketenkrypta (okf/features/
// missiles.md): 20,000 Adamant, 20,000 Psikristall, 1,000 Promethium,
// factor 2, 10 places per level (owner, 2026-11-16, Q1); it needs the
// Orbitale Schiffsschmiede 1 [V] and stands on planets only [V]. It comes
// after the buildings of the moon [V].
import type { BuildingFields } from '../../core/catalog.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Silo } from '../../core/components/silo.ts';

export const kind = 'building';
export const order = 180;
export const leveled: Required<Leveled> = {
  cost: [20000, 20000, 1000],
  f: 2,
};
export const silo: Silo = {
  slots: 10,
};
export const def: BuildingFields = {
  req: { b: { yard: 1 } },
};
