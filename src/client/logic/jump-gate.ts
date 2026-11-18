// The Warp-Tor in the fleet view (#53, #230; owner, 2026-11-13 and
// 2026-11-16): on a moon with a Warp-Tor the player picks ships above and a
// „Zielmond“ here, another own moon with a Warp-Tor, and jumps with
// „Springen“. Both gates must be ready, as the server checks with
// `jumpError`: a cooling gate shows „Wieder bereit in …“, the start below
// the button, a target in its option, which is disabled until then. The
// box is drawn again once when a gate turns ready (`viewDue`), and a redraw
// keeps the picked „Zielmond“ only while its option is enabled (`keeps`).
import {
  type Gate,
  type GateView,
  gateLevel,
  gateReady,
  targetError,
} from '../../core/jump-gate.ts';
import { placeName } from '../../core/moon.ts';
import type { Planet, ResearchState } from '../../core/types.ts';
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

/** What the clock needs of the shown view: the place, the research, the state and its time. */
interface Shown {
  s: Pick<GameState, 'gates'>;
  P: Planet;
  R: Pick<ResearchState, 'rq'>;
  /** When the view was drawn. */
  now: number;
}

/** Whether an order of the shown place or the research has ended at `now`. */
function queueDue({ P, R }: Shown, now: number): boolean {
  const ship = P.sq[0];
  const nextShip = ship ? (P.sqT ?? now) + ship.unit : Infinity;
  return (
    Math.min(P.bq?.end ?? Infinity, R.rq?.end ?? Infinity, nextShip) <= now
  );
}

/**
 * Whether an own Warp-Tor turned ready between the drawing of the view and
 * `now`, on a moon with a Warp-Tor: the box enables „Springen“ and the
 * target then. True once per gate, since the redraw moves the time of the
 * view past the readiness.
 */
const gateDue = (v: Shown, now: number): boolean =>
  gateLevel(v.P) > 0 &&
  (v.s.gates ?? []).some((g) => g.ready > v.now && g.ready <= now);

/** Whether the clock draws the shown view again at `now`: a finished order or research, or a Warp-Tor that turned ready. */
export const viewDue = (v: Shown, now: number): boolean =>
  queueDue(v, now) || gateDue(v, now);

/** The options of a select, as a redraw of the view finds them. */
type Options = ArrayLike<{ value: string; disabled: boolean }>;

/**
 * Whether a redraw restores the saved `value` of a form field: not onto a
 * disabled option of a select, such as a „Zielmond“ that cools down since.
 * The select then keeps the option the redraw picked, the first enabled.
 */
export function keeps(field: object, value: string): boolean {
  const options = (field as { options?: Options | null }).options ?? [];
  return !Array.from(options).find((o) => o.value === value)?.disabled;
}
