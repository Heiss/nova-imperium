// All unmet requirements of an entry, the indirect ones included, and whether
// the next level of each can be started now (issue #64, D1–D5).
// Everything belongs to the shown planet: research starts and is paid on any
// own planet with a Forschungslabor, so the buildings it needs are built
// there too (issue #49, replaces the home planet rule of #64 D4).
import { BUILD, RES } from './catalog.ts';
import { afford, lvlCost, reqMissing } from './economy.ts';
import { fieldsFull } from './fields.ts';
import { labUpgrading, waitsForLab } from './lab.ts';
import { energyNeed, energyShort } from './research.ts';
import { waitsForYard } from './yard.ts';
import type {
  Cost,
  Planet,
  Requirements,
  ResearchState,
  Universe,
} from './types.ts';

export interface Need {
  kind: 'b' | 'r';
  key: string;
  name: string;
  /** The level the entry needs. */
  level: number;
  /** The level today. */
  have: number;
  /** The name of the requirement that needs this one (indirect only). */
  via?: string;
}

export interface Places {
  here: Planet;
  research: ResearchState;
  cfg: Universe;
}

interface Step {
  kind: 'b' | 'r';
  key: string;
  level: number;
  via?: string;
}

const defOf = (kind: 'b' | 'r', key: string) =>
  (kind === 'b' ? BUILD : RES)[key];

/** The direct requirements of an entry as steps. */
function stepsOf(req: Requirements | undefined, via?: string): Step[] {
  const of = (kind: 'b' | 'r') =>
    Object.entries(req?.[kind] ?? {}).map(([key, level]): Step => ({
      kind,
      key,
      level,
      via,
    }));
  return [...of('b'), ...of('r')];
}

function add(found: Map<string, Need>, id: string, need: Need): boolean {
  const old = found.get(id);
  if (!old) {
    found.set(id, need);
    return true;
  }
  old.level = Math.max(old.level, need.level);
  if (!need.via) delete old.via;
  return false;
}

/** The need of an unmet step, or null when the step is met. */
function needOf(s: Step, pl: Places): Need | null {
  const levels = s.kind === 'r' ? pl.research.research : pl.here.b;
  const have = levels[s.key] ?? 0;
  if (have >= s.level) return null;
  const need: Need = {
    kind: s.kind,
    key: s.key,
    name: defOf(s.kind, s.key)?.n ?? s.key,
    level: s.level,
    have,
  };
  if (s.via) need.via = s.via;
  return need;
}

/** Breadth first, so the direct requirements come first; each one once. */
export function unmetRequirements(
  req: Requirements | undefined,
  pl: Places,
): Need[] {
  const found = new Map<string, Need>();
  const queue = stepsOf(req);
  while (queue.length) {
    const s = queue.shift()!;
    const need = needOf(s, pl);
    if (need && add(found, `${s.kind}:${s.key}`, need))
      queue.push(...stepsOf(defOf(s.kind, s.key)?.req, need.name));
  }
  return [...found.values()];
}

export interface NeedState {
  /** The next level is allowed and affordable now (D2). */
  ready: boolean;
  /** Why it is not ready. */
  reason?: string;
  /** Ready, but its queue is in use: the button waits. */
  busy?: string;
  /** Cost of the next level. */
  cost: Cost;
  /**
   * Energy production the next level needs (Gravitonforschung #49,
   * Weltenschmiede #51).
   */
  energy?: number;
}

const RES_NAMES = ['Adamant', 'Psikristall', 'Promethium'] as const;
const HAVE = ['m', 'c', 'd'] as const;

const lacking = (p: Planet, c: Cost, energy: boolean): string[] => [
  ...RES_NAMES.filter((_, i) => p.res[HAVE[i]!] < c[i]!),
  ...(energy ? ['Energie'] : []),
];

function busyReason(n: Need, p: Planet, r: ResearchState): string | undefined {
  if (n.kind === 'r') {
    if (r.rq) return 'Es wird bereits geforscht';
    return labUpgrading(p) ? 'Scholarium wird ausgebaut' : undefined;
  }
  if (p.bq) return 'Bauschleife belegt';
  if (waitsForYard(p, n.key)) return 'Schiffsschmiede arbeitet gerade';
  if (waitsForLab(r, n.key)) return 'Das Scholarium forscht gerade';
  return undefined;
}

export function needState(n: Need, pl: Places): NeedState {
  const p = pl.here;
  const def = defOf(n.kind, n.key)!;
  const level = n.have + 1;
  const cost = lvlCost(def, level);
  const energy = energyNeed(def, level);
  const base: NeedState = energy
    ? { ready: false, cost, energy }
    : { ready: false, cost };
  const missing = reqMissing(def, p, pl.research);
  if (missing.length)
    return { ...base, reason: `braucht ${missing.join(', ')}` };
  // Every building level takes a field (#51).
  if (n.kind === 'b' && fieldsFull(p, pl.cfg))
    return { ...base, reason: 'Keine freien Felder' };
  const short = energyShort(def, level, p, pl.cfg, pl.research.research) > 0;
  if (!afford(p, cost) || short)
    return {
      ...base,
      reason: `zu wenig ${lacking(p, cost, short).join(', ')}`,
    };
  const busy = busyReason(n, p, pl.research);
  return busy ? { ...base, ready: true, busy } : { ...base, ready: true };
}
