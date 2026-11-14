// The component `placement` (okf/architecture/patterns.md, sections 1 and 6;
// #53): the kinds of place where a building can be built. A building without
// it stands on planets only, as every building did before the moons; the
// Servitorenschmiede, the Orbitale Schiffsschmiede and the three stores stand
// on both, the Mondzitadelle on moons only (owner, 2026-11-13 and
// 2026-11-14). Only this module reads the component; catalog.ts asks it
// through `buildable`.
import type { Planet } from '../types.ts';

/** The kinds of place a building can stand on. */
export type Placement = readonly Planet['kind'][];

/** Without the component: planets only. */
export const PLANET_ONLY: Placement = ['planet'];

/** Whether a building with this placement can be built on a place of the kind. */
export const placeable = (
  placement: Placement | undefined,
  kind: Planet['kind'],
): boolean => (placement ?? PLANET_ONLY).includes(kind);
