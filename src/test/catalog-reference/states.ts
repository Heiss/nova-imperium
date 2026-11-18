// A frozen copy of buildState() and researchState() of
// src/client/logic/game.ts before #214, for
// src/test/catalog-list-reference.test.ts and Buildings.svelte beside it:
// the lists must show the notes they showed before the checks moved into
// src/core/economy-checks.ts. Only the imports and the exports changed. Do
// not change it.
import { labUpgrading, waitsForLab } from '../../core/lab.ts';
import { waitsForYard } from '../../core/yard.ts';
import type { Planet, ResearchState } from '../../core/types.ts';

type BuildState =
  | 'running'
  | 'missing'
  | 'full'
  | 'queueBusy'
  | 'yardBusy'
  | 'labBusy'
  | 'noEnergy'
  | 'ready';

/**
 * `full`: the planet has no free field (#51); `noEnergy`: the planet lacks
 * energy production; `short`: the energy production the planet lacks
 * (Weltenschmiede, #51).
 */
export function buildState(
  p: Planet,
  r: ResearchState,
  key: string,
  missing: number,
  full = false,
  short = 0,
): BuildState {
  if (p.bq?.key === key) return 'running';
  if (missing) return 'missing';
  return buildWait(p, r, key, full, short);
}

/** What a building whose requirements are met waits for, if anything. */
function buildWait(
  p: Planet,
  r: ResearchState,
  key: string,
  full: boolean,
  short: number,
): BuildState {
  if (full) return 'full';
  if (p.bq) return 'queueBusy';
  if (waitsForYard(p, key)) return 'yardBusy';
  if (waitsForLab(r, key)) return 'labBusy';
  return short > 0 ? 'noEnergy' : 'ready';
}

type ResearchUiState =
  'running' | 'missing' | 'busy' | 'labBusy' | 'noEnergy' | 'ready';

/** `short`: the energy production the planet lacks (Gravitonforschung, #49). */
export function researchState(
  p: Planet,
  r: ResearchState,
  key: string,
  missing: number,
  short = 0,
): ResearchUiState {
  if (r.rq?.key === key) return 'running';
  if (missing) return 'missing';
  if (r.rq) return 'busy';
  if (labUpgrading(p)) return 'labBusy';
  if (short > 0) return 'noEnergy';
  return 'ready';
}
