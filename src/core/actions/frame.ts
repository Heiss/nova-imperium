// The input of the actions of the core game: queues, shares, name, display options, reports (#317); see ../actions.ts.
import { type Attr, input, type None } from '../action-input.ts';

export const actionInputs = {
  build: input<{
    key: string;
    /** An alias of the planet the envelope carries; the browser does not send it. */
    at?: string;
  }>(),
  cancelBuild: input<None>(),
  research: input<{ key: string }>(),
  cancelResearch: input<None>(),
  order: input<{ key: string; n: number }>(),
  cancelOrder: input<{ pos: number; key: Attr }>(),
  pct: input<{ key: Attr; v: string | number }>(),
  rename: input<{ name: string }>(),
  options: input<{ probes: number; explain?: string; levelTable?: string }>(),
  read: input<None>(),
  delrep: input<{ id: Attr }>(),
  delall: input<None>(),
};
