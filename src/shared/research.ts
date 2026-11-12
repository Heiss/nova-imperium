// Research on any own planet with a Forschungslabor (issue #49), used by the
// server and the browser: the research network (IFN) that links further labs
// for the research time, and the energy production Gravitonforschung needs.
import { RES, type ResearchDef } from './catalog.ts';
import { prod } from './economy.ts';
import { labUpgrading } from './lab.ts';
import type { Planet, Universe } from './types.ts';

/** One own planet as the research network sees it. */
export interface LabSite {
  id: string;
  lab: number;
  /** Its lab is being upgraded: it does not join the network. */
  upgrading: boolean;
}

export const labSite = (p: Pick<Planet, 'id' | 'b' | 'bq'>): LabSite => ({
  id: p.id,
  lab: p.b.lab ?? 0,
  upgrading: labUpgrading(p),
});

/**
 * The lab level that counts for the research time of `key` started at
 * `here`: its own lab plus the `ifn` highest other labs among `labs`. A lab
 * joins only when its own level meets the lab requirement of the research
 * and it is not being upgraded; the levels are added.
 */
export function networkLab(
  key: string,
  here: LabSite,
  labs: readonly LabSite[],
  ifn: number,
): number {
  const need = RES[key]?.req.b?.lab ?? 0;
  return labs
    .filter((s) => s.id !== here.id && !s.upgrading && s.lab >= need)
    .map((s) => s.lab)
    .sort((a, b) => b - a)
    .slice(0, ifn)
    .reduce((sum, lab) => sum + lab, here.lab);
}

/** The energy production level `level` of `d` needs; 0 for most research. */
export const energyNeed = (
  d: Pick<ResearchDef, 'energy'>,
  level: number,
): number => (d.energy ? d.energy.base * Math.pow(d.energy.f, level - 1) : 0);

/**
 * How much energy production `p` lacks for level `level` of `d`, rounded
 * up; 0 when it is enough. The production counts, not the use (#49).
 */
export const energyShort = (
  d: Pick<ResearchDef, 'energy'>,
  level: number,
  p: Pick<Planet, 'b' | 'pct' | 'temp'>,
  u: Universe,
): number => Math.max(0, Math.ceil(energyNeed(d, level) - prod(p, u).eProd));
