// The state of the fleet form (#332): the ships, the target position, the
// speed, the cargo and the names typed to invite into a union. The component
// Fleet binds it and features/fleet.ts and features/union.ts read and write
// it, so the redraw of the poll, which mounts the view anew, shows it again.
// A fresh render (another view or planet, or a fleet that was sent) drops it
// (form-state.svelte.ts). A field of the position that nobody typed in (null)
// shows the target of the page; the speed is null while the first is chosen.
import type { Resources } from '../../core/types.ts';
import { formState } from './form-state.svelte.ts';

export interface FleetDraft {
  /** The number typed for a ship, by its key. */
  ships: Record<string, string>;
  /** The target position as typed, or null while the field shows the page. */
  to: { g: string | null; s: string | null; p: string | null };
  /** The chosen speed, or null while the first one is. */
  speed: string | null;
  /** The cargo typed per resource. */
  cargo: Partial<Record<keyof Resources, string>>;
  /** The name typed to invite into a union, by the id of the union. */
  invite: Record<string, string>;
  /** The kind of target chosen, or null while the page says it (logic/fleet-choice.ts). */
  kind: 'planet' | 'moon' | null;
  /** The mission chosen, or null while the page says it (logic/fleet-choice.ts). */
  mission: string | null;
  /** The union chosen (empty for „Kein Verband“), or null while the page says it. */
  union: string | null;
  /** The holding time chosen (hours), or null while the first is shown. */
  hold: string | null;
  /** The hours of stay typed for an expedition, or null while 1 is shown. */
  stay: string | null;
}

export const fleetForm = formState((): FleetDraft => ({
  ships: {},
  to: { g: null, s: null, p: null },
  speed: null,
  cargo: {},
  invite: {},
  kind: null,
  mission: null,
  union: null,
  hold: null,
  stay: null,
}));
