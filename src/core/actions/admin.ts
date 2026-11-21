// The input of the actions of the admin: the settings and the new round (#317); see ../actions.ts.
import { input } from '../action-input.ts';
import type { Universe } from '../types.ts';

export const actionInputs = {
  /** The form sends the texts of its fields by key; the server reads numbers too. */
  settings: input<{
    settings: Readonly<Partial<Universe>> | Readonly<Record<string, string>>;
  }>(),
  /** The values of the settings of a round by name, groups nested (`roundRequest`); all optional. */
  reset: input<Record<string, unknown>>(),
};
