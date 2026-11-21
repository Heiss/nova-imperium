// The key of the Warp-Tore in the state (#230, #317).
import type { GateView } from '../jump-gate.ts';

export type StateShape = {
  /** The own Warp-Tore with their readiness (#230). */
  gates: GateView[];
};
