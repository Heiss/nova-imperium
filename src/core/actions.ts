// The compile-time contract between the browser and the server for actions
// (#317, #118; okf/architecture/patterns/14-server-features.md): `ActionMap`
// is the merge of the declarations of all files of `src/core/actions/` (the
// list is generated, scripts/gen-features.ts). The server checks every handler
// against it, the browser every `act(...)` call. Types do not replace the
// validation of the server: the input arrives as JSON and every handler still
// checks what it reads.
import { ACTION_INPUTS } from './actions.gen.ts';

type Merge<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

/** Every action by name with its input, from all files of `src/core/actions/`. */
type ActionMap = Merge<(typeof ACTION_INPUTS)[number][1]>;

export type ActionName = keyof ActionMap & string;

/** The input of the action `K`. */
type ActionInput<K extends ActionName> = ActionMap[K]['input'];

/** What the browser adds to every action it sends: the planet shown (`logic/act.ts`). */
interface Envelope {
  planet?: string;
}

/** What a handler of the server gets for the action `K`. */
export type Wire<K extends ActionName> = ActionInput<K> & Envelope;
