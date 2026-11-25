// The input of the actions of fleets: sending, recalling (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';
import type { CargoIntent } from '../cargo-fill.ts';
import type { Coords, Levels, Resources } from '../types.ts';

/** The order of a fleet as the fleet form builds it. */
export interface FleetOrder {
  ships: Levels;
  /** The position, and whether the planet or its moon (#53). */
  to: Coords & { kind?: 'planet' | 'moon' };
  mission: string;
  /** The speed in tenths, one to ten; the server takes the slowest when it is missing. */
  pct?: number;
  /** What the fleet carries; what is missing is nothing. */
  cargo?: Partial<Resources>;
  /**
   * What the „alles“ buttons asked for (#407): the server computes those
   * fields from its stock at the launch; `cargo` holds them as the preview.
   */
  cargoAll?: CargoIntent;
  /** The holding time of a Halten in hours (#55). */
  hold?: number;
  /** The hours an expedition stays at its position (#93). */
  stay?: number;
  /** The attack union the fleet joins (#225). */
  union?: string;
}

export const actionInputs = {
  send: input<FleetOrder>(),
  recall: input<{ id: Attr }>(),
};
