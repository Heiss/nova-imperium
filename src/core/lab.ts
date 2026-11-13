// The lab lock, used by the server and the client: research waits while the
// Forschungslabor is upgraded, and the lab waits while research runs.
import type { Planet, ResearchState } from './types.ts';

/** Whether research must wait because the lab of this planet is upgraded. */
export const labUpgrading = (p: Pick<Planet, 'bq'>): boolean =>
  p.bq?.key === 'lab';

/** Whether an upgrade of `key` must wait for the running research. */
export const waitsForLab = (
  r: Pick<ResearchState, 'rq'>,
  key: string,
): boolean => key === 'lab' && !!r.rq;
