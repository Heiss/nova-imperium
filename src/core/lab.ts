// The lab lock, used by the server and the client: research waits while the
// Forschungslabor is upgraded, and the lab waits while research runs.
import type { Planet, ResearchState } from './types.ts';

/** Whether the place has a lab, where research can start (#49). */
export const hasLab = (p: Pick<Planet, 'b'>): boolean => (p.b.lab ?? 0) > 0;

/** Whether research must wait because the lab of this planet is upgraded. */
export const labUpgrading = (p: Pick<Planet, 'bq'>): boolean =>
  p.bq?.key === 'lab';

/** Whether an upgrade of `key` must wait for the running research. */
export const waitsForLab = (
  r: Pick<ResearchState, 'rq'>,
  key: string,
): boolean => key === 'lab' && !!r.rq;
