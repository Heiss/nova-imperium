// The lab lock, used by the server and the client: research waits while the
// Forschungslabor is upgraded, and the lab waits while research runs. The
// buildings that stop the research come from their component `locks` (#183):
// no rule here names a catalog key.
import { LOCKS } from './catalog.ts';
import { homeOf, stops } from './components/locks.ts';
import type { Planet, ResearchState } from './types.ts';

/** The building that is the place of the research: the lab. */
const LAB = homeOf(LOCKS, 'research')!;

/** Whether the place has a lab, where research can start (#49). */
export const hasLab = (p: Pick<Planet, 'b'>): boolean => (p.b[LAB] ?? 0) > 0;

/** Whether research must wait because the lab of this planet is upgraded. */
export const labUpgrading = (p: Pick<Planet, 'bq'>): boolean =>
  !!p.bq && stops(LOCKS, p.bq.key, 'research');

/** Whether an upgrade of `key` must wait for the running research. */
export const waitsForLab = (
  r: Pick<ResearchState, 'rq'>,
  key: string,
): boolean => stops(LOCKS, key, 'research') && !!r.rq;
