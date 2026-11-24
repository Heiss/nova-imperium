// The boxes of „Optionen“ in their order (#378): the boxes of every listed
// module. A key or an order number defined twice stops the start with both
// files named, so no box silently replaces another.
import { collect } from '../assemble.ts';

/** What the assembly reads of a box. */
interface Placed {
  key: string;
  order: number;
}

/** The modules as the generated list gives them: `[name in this folder, optionBoxes]`. */
export type ListedBoxes<B extends Placed> = readonly (readonly [
  string,
  readonly B[],
])[];

/** The boxes of all modules by ascending order number, each key and number once. */
export function assembleBoxes<B extends Placed>(
  listed: ListedBoxes<B>,
): readonly B[] {
  const declared = listed.flatMap(([name, boxes]) =>
    boxes.map((box) => ({ file: `src/client/views/options/${name}.ts`, box })),
  );
  collect(
    'option box',
    declared.map((d) => [d.box.key, d.file, d.box] as const),
  );
  const table = collect(
    'option box number',
    declared.map((d) => [String(d.box.order), d.file, d.box] as const),
  );
  return [...table.values()]
    .map((owned) => owned.value)
    .sort((a, b) => a.order - b.order);
}
