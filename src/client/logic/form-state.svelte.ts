// The state of a form (#332, a follow-up of #118, package 8). A view that is
// mounted anew on every render (`anew`) loses what its component held, so a
// form keeps its fields here, in a module of its own, and the component binds
// them (`bind:value`) and the handler reads them. The state is dropped where
// the typed fields were always dropped: by a fresh render (another view or
// planet) and by a logout (`forgetForms`, called by render.ts).

/** Puts every state back to its start. */
const resets: Array<() => void> = [];

/**
 * A reactive state object for one form. `start` makes its fresh value; a
 * record with keys that come and go (one field per row) starts empty.
 */
export function formState<T extends object>(start: () => T): T {
  const state = $state(start());
  resets.push(() => {
    for (const key of Object.keys(state)) delete (state as never)[key];
    Object.assign(state, start());
  });
  return state;
}

/** Drops what every form holds: the fields show the page again. */
export function forgetForms(): void {
  for (const reset of resets) reset();
}

/** Whether an option is selected: the one chosen, else the one of the page. */
export const isChosen = (
  chosen: string | undefined,
  option: { value: string; selected: boolean },
): boolean =>
  chosen === undefined ? option.selected : chosen === option.value;
