// The boxes of „Optionen“ put together (#378): every box of the generated list
// in its order, and the page as the parts of all boxes. Options.svelte draws
// them and logic/options.ts hands the page on; neither names a box.
import type { V } from '../common.ts';
import { assembleBoxes } from './assemble.ts';
import { OPTION_BOXES } from './boxes.gen.ts';
import type { OptionBox } from './contract.ts';

/** Every declared box, of whichever part. */
type Declared = (typeof OPTION_BOXES)[number][1][number];

/** The part of the page a box shows. */
type Part<B> = B extends OptionBox<infer P> ? P : never;

/** A union of parts as one type that has them all. */
type All<U> = (U extends unknown ? (part: U) => void : never) extends (
  part: infer I,
) => void
  ? I
  : never;

/** What the page shows: the parts of all boxes. */
export type OptionsPage = All<Part<Declared>>;

/** The boxes of the page in their order, each drawn with the whole page. */
export const BOXES = assembleBoxes<Declared>(
  OPTION_BOXES,
) as unknown as readonly OptionBox<OptionsPage>[];

/** The page at the view state `v`: the parts of all boxes together. */
export const optionsPage = (v: V): OptionsPage =>
  Object.assign({}, ...BOXES.map((box) => box.data?.(v))) as OptionsPage;
