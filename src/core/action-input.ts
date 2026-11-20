// The declaration of the input of an action: each file of src/core/actions/
// exports `actionInputs = { name: input<{ ... }>(), ... }`; `ActionMap`
// (actions.ts) is the merge of them. Kept apart from actions.ts, which imports
// the generated list of those files.

/** What the browser reads from a `data-*` attribute: a text, or nothing when the attribute is missing. */
export type Attr = string | undefined;

/** The input of an action that takes none. */
export type None = Record<never, never>;

/** Declares the type of the input of one action; only the type counts, the value is empty. */
export const input = <T = None>(): { readonly input: T } =>
  ({}) as { readonly input: T };
