// All unmet requirements of an entry, the indirect ones included, and whether
// the next level of each can be started now (issue #64, D1–D5).
// Everything belongs to the shown planet: research starts and is paid on any
// own planet with a Forschungslabor, so the buildings it needs are built
// there too (issue #49, replaces the home planet rule of #64 D4).
import { BUILD, RES } from './catalog.ts';
import { energyNeed } from './components/energy-threshold.ts';
import {
  type BuildError,
  buildErrors,
  type ResearchError,
  researchErrors,
} from './economy-checks.ts';
import { lvlCost, reqMissing } from './economy.ts';
import { CLOSED } from './market-text.ts';
import { text } from './text.ts';
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
    name: text(s.key)?.n ?? s.key,
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

/** Why a building cannot stand on the shown place (#53). */
const PLACE_REASON = {
  planet: 'nur auf einem Mond baubar',
  moon: 'auf einem Mond nicht baubar',
} as const;

const RES_NAMES = ['Adamant', 'Psikristall', 'Promethium'] as const;
const HAVE = ['m', 'c', 'd'] as const;

const lacking = (p: Planet, c: Cost, energy: boolean): string[] => [
  ...RES_NAMES.filter((_, i) => p.res[HAVE[i]!] < c[i]!),
  ...(energy ? ['Energie'] : []),
];

/**
 * The waits of the list, in its order: the next level is ready, but its
 * queue is in use (codes of `buildErrors` and `researchErrors`, F18).
 */
const BUILD_WAITS: Readonly<Partial<Record<BuildError, string>>> = {
  busy: 'Bauschleife belegt',
  yardBusy: 'Schiffsschmiede arbeitet gerade',
  labBusy: 'Das Scholarium forscht gerade',
};
const RESEARCH_WAITS: Readonly<Partial<Record<ResearchError, string>>> = {
  busy: 'Es wird bereits geforscht',
  labUpgrading: 'Scholarium wird ausgebaut',
};

/**
 * Why the place refuses the entry at all: it cannot stand there (#53), or
 * the round does not offer it, the Handelsposten while the marketplace is
 * off (#442, the words of the marketplace).
 */
function refusedHere(
  errors: readonly string[],
  kind: Planet['kind'],
  build: boolean,
): string | null {
  if (errors.includes('place')) return PLACE_REASON[kind];
  // Only a building: the list never names a research the round does not have.
  return build && errors.includes('off') ? CLOSED : null;
}

/**
 * Whether the next level can start now and why not, in the order of the
 * list (#64): the place, the requirements, the fields, the price and the
 * energy, then the waits. The checks are those of the actions, `buildErrors`
 * and `researchErrors` (#214, F18, owner 2026-11-16); the list keeps its
 * own short reasons and its order, and names no reason of the actions it
 * never showed (a research the round does not have, its highest level, a
 * place without a lab).
 */
export function needState(n: Need, pl: Places): NeedState {
  const p = pl.here;
  const def = defOf(n.kind, n.key)!;
  const level = n.have + 1;
  const cost = lvlCost(def, level);
  const energy = energyNeed(def, level);
  const base: NeedState = energy
    ? { ready: false, cost, energy }
    : { ready: false, cost };
  const build = n.kind === 'b';
  const errors: readonly string[] = build
    ? buildErrors(p, pl.research, n.key, pl.cfg, n.have)
    : researchErrors(p, pl.research, n.key, pl.cfg, n.have);
  const refused = refusedHere(errors, p.kind, build);
  if (refused) return { ...base, reason: refused };
  if (errors.includes('locked'))
    return {
      ...base,
      reason: `braucht ${reqMissing(def, p, pl.research).join(', ')}`,
    };
  // Every building level takes a field (#51).
  if (errors.includes('full'))
    return { ...base, reason: 'Keine freien Felder' };
  const short = errors.includes('noEnergy');
  if (errors.includes('cost') || short)
    return {
      ...base,
      reason: `zu wenig ${lacking(p, cost, short).join(', ')}`,
    };
  const waits: Readonly<Record<string, string | undefined>> = build
    ? BUILD_WAITS
    : RESEARCH_WAITS;
  const busy = errors.map((code) => waits[code]).find(Boolean);
  return busy ? { ...base, ready: true, busy } : { ...base, ready: true };
}
