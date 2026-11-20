// The input of the actions of the Raketenangriff (#317); see ../actions.ts.
import { input } from '../action-input.ts';
import type { Coords } from '../types.ts';

export const actionInputs = {
  missile: input<{
    to: Coords & { kind: 'planet' | 'moon' };
    n: number;
    /** The main target, none for no main target. */
    aim: string | null;
  }>(),
};
