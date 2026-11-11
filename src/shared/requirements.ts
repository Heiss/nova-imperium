// All unmet requirements of an entry, the indirect ones included, and whether
// the next level of each can be started now (issue #64, D1–D5).
// Buildings belong to a planet: the requirements of an entry on the shown
// planet are built there, the buildings that research needs on the home
// planet (owner decision). Research is always started and paid on the home
// planet (D4).
import { BUILD, RES } from './catalog.ts';
import { afford, lvlCost, reqMissing } from './economy.ts';
import { labUpgrading, waitsForLab } from './lab.ts';
import { waitsForYard } from './yard.ts';
import type {
  Cost,
  Levels,
  Planet,
  Requirements,
  ResearchState,
} from './types.ts';

export interface Need {
  kind: 'b' | 'r';
  key: string;
  name: string;
  /** The level the entry needs. */
  level: number;
  /** The level today. */
  have: number;
  /** The planet id where the next level is built (research: the home planet). */
  planet: string;
  /** The name of the requirement that needs this one (indirect only). */
  via?: string;
}

export interface Places {
  here: Planet;
  home: Planet;
  research: ResearchState;
}

type At = 'here' | 'home';
interface Step {
  kind: 'b' | 'r';
  key: string;
  level: number;
  at: At;
  via?: string;
}

const defOf = (kind: 'b' | 'r', key: string) =>
  (kind === 'b' ? BUILD : RES)[key];

const levelsOf = (s: Step, pl: Places): Levels =>
  s.kind === 'r' ? pl.research.research : pl[s.at].b;

/** The direct requirements of an entry as steps; research always counts from home. */
function stepsOf(req: Requirements | undefined, at: At, via?: string): Step[] {
  const b = Object.entries(req?.b ?? {}).map(([key, level]): Step => ({
    kind: 'b',
    key,
    level,
    at,
    via,
  }));
  const r = Object.entries(req?.r ?? {}).map(([key, level]): Step => ({
    kind: 'r',
    key,
    level,
    at: 'home',
    via,
  }));
  return [...b, ...r];
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
  const have = levelsOf(s, pl)[s.key] ?? 0;
  if (have >= s.level) return null;
  const need: Need = {
    kind: s.kind,
    key: s.key,
    name: defOf(s.kind, s.key)?.n ?? s.key,
    level: s.level,
    have,
    planet: s.kind === 'r' ? pl.home.id : pl[s.at].id,
  };
  if (s.via) need.via = s.via;
  return need;
}

/** Breadth first, so the direct requirements come first; each one once. */
export function unmetRequirements(
  req: Requirements | undefined,
  at: At,
  pl: Places,
): Need[] {
  const found = new Map<string, Need>();
  const queue = stepsOf(req, at);
  while (queue.length) {
    const s = queue.shift()!;
    const need = needOf(s, pl);
    if (need && add(found, `${s.kind}:${need.planet}:${s.key}`, need)) {
      const next = s.kind === 'r' ? 'home' : s.at;
      queue.push(...stepsOf(defOf(s.kind, s.key)?.req, next, need.name));
    }
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
}

const RES_NAMES = ['Metall', 'Kristall', 'Deuterium'] as const;
const HAVE = ['m', 'c', 'd'] as const;

const lacking = (p: Planet, c: Cost): string[] =>
  RES_NAMES.filter((_, i) => p.res[HAVE[i]!] < c[i]!);

function busyReason(n: Need, p: Planet, r: ResearchState): string | undefined {
  if (n.kind === 'r') {
    if (r.rq) return 'Es wird bereits geforscht';
    return labUpgrading(p) ? 'Labor wird ausgebaut' : undefined;
  }
  if (p.bq) return 'Bauschleife belegt';
  if (waitsForYard(p, n.key)) return 'Werft arbeitet gerade';
  if (waitsForLab(r, n.key)) return 'Das Labor forscht gerade';
  return undefined;
}

export function needState(n: Need, pl: Places): NeedState {
  const p = n.planet === pl.here.id ? pl.here : pl.home;
  const def = defOf(n.kind, n.key)!;
  const cost = lvlCost(def, n.have + 1);
  const missing = reqMissing(def, p, pl.research);
  if (missing.length)
    return { ready: false, reason: `braucht ${missing.join(', ')}`, cost };
  if (!afford(p, cost))
    return {
      ready: false,
      reason: `zu wenig ${lacking(p, cost).join(', ')}`,
      cost,
    };
  const busy = busyReason(n, p, pl.research);
  return busy ? { ready: true, busy, cost } : { ready: true, cost };
}
