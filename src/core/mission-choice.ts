// The missions that fit a target (#253, owner, 2026-11-16): the fleet form
// offers only these. The filter asks the target kind of each mission's
// rules with the same `suits` as the send check and the arrival
// (okf/architecture/patterns.md, section 4), so a new mission plugs in
// through its own rules.ts. It is for the interface only: the server keeps
// its checks (section 7), and a mission's own `canSend` (its ships, the
// noob protection) is not asked here.
import { MISSION, missionRules, shunsMoon, suits } from './missions.ts';
import type { Mission, Planet } from './types.ts';

/** What is at the target of the fleet form. */
export interface TargetSite {
  /**
   * The planet at the position, or the moon when the fleet flies to it
   * (#53); null for a free position.
   */
  planet: Pick<Planet, 'owner'> | null;
  /** Whether a Trümmerfeld lies at the position (#45). */
  debris: boolean;
  /** Whether the fleet flies to the moon of the position; missing: the planet. */
  moon?: boolean;
  /**
   * Whether `planet` is the place the fleet starts from: no mission flies
   * to its own start (owner, 2026-11-17).
   */
  start?: boolean;
}

/**
 * The missions whose target kind fits the site for a fleet of `owner`, in
 * the order of the fleet form. A moon as target is decided by the moon's
 * own target kind: no free position and no Trümmerfeld is a moon. The place
 * the fleet starts from takes no mission; a Trümmerfeld beside it is a
 * place of its own (#119) and keeps its Bergung.
 */
export const missionsFor = (owner: string, site: TargetSite): Mission[] =>
  (Object.keys(MISSION) as Mission[]).filter((m) => {
    const kind = missionRules(m)!.target;
    return (
      !shunsMoon(kind, site.moon) &&
      (kind === 'debris' || !site.start) &&
      suits(kind, owner, site.planet, site.debris)
    );
  });
