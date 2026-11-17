// The Warp-Tor in the fleet view (#53, #230; owner, 2026-11-13 and
// 2026-11-16): on a moon with a Warp-Tor the player picks ships above and a
// „Zielmond“ here, another own moon with a Warp-Tor, and jumps with
// „Springen“. Both gates must be ready, as the server checks with
// `jumpError`: a cooling gate shows „Wieder bereit in …“, the start below
// the button, a target in its option, which is disabled until then.
import {
  type Gate,
  type GateView,
  gateLevel,
  gateReady,
  targetError,
} from '../../core/jump-gate.ts';
import { placeName } from '../../core/moon.ts';
import type { Planet } from '../../core/types.ts';
import { coords, dur } from './format.ts';
import type { GameState } from './types.ts';

/** One option of „Zielmond“. */
interface JumpTarget {
  id: string;
  label: string;
  /** Whether its gate cools down: the option is disabled. */
  disabled: boolean;
}

/** The box „Warp-Tor“ of the fleet view. */
export interface JumpPanel {
  /** When the gate of this moon is ready again, if it cools down. */
  cooling: number | null;
  targets: JumpTarget[];
  /** Whether „Springen“ is offered: this gate ready and a target ready. */
  canJump: boolean;
}

type Seen = Pick<GameState, 'gates' | 'galaxy'>;

/** An option of „Zielmond“, or null when the gate is no target of `from`. */
function targetOf(s: Seen, from: Gate, view: GateView, now: number) {
  const place = s.galaxy.find((g) => g.id === view.id);
  if (!place) return null;
  const gate = { ...place, b: { jumpgate: view.level }, ready: view.ready };
  const error = targetError(from, gate, now);
  if (error && error !== 'targetCooling') return null;
  const name = `${placeName(place)} ${coords(place)}`;
  return error
    ? {
        id: view.id,
        label: `${name} – Wieder bereit in ${dur(view.ready - now)}`,
        disabled: true,
      }
    : { id: view.id, label: name, disabled: false };
}

/**
 * The box of the Warp-Tor on the place `here` at `now`, or null when no
 * Warp-Tor stands there. The targets are the player's other moons with a
 * Warp-Tor, in the order of the state.
 */
export function jumpPanel(
  s: Seen,
  here: Planet,
  now: number,
): JumpPanel | null {
  if (gateLevel(here) < 1) return null;
  const own = s.gates?.find((g) => g.id === here.id);
  const from: Gate = { ...here, ready: own?.ready ?? 0 };
  const targets = (s.gates ?? []).flatMap((view) => {
    const target = targetOf(s, from, view, now);
    return target ? [target] : [];
  });
  const ready = gateReady(from, now);
  return {
    cooling: ready ? null : from.ready,
    targets,
    canJump: ready && targets.some((t) => !t.disabled),
  };
}
