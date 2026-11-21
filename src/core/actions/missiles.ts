// The input of the actions of the Raketenangriff (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';
import type { Coords } from '../types.ts';

export const actionInputs = {
  missile: input<{
    to: Coords & { kind: 'planet' | 'moon' };
    n: number;
    /** The main target, none for no main target. */
    aim: string | null;
  }>(),
  /** Tears down `n` stored missiles of `key` on the selected planet (#54, 2026-11-21). */
  tearDownMissiles: input<{ key: Attr; n: number }>(),
};
