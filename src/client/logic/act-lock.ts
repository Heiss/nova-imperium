// The lock of a clicked `data-act` element (#425, owner, 2026-11-26, 186a), and
// of a submitted form (#428, owner, 2026-11-27, 284a): while
// the promise of its handler runs, a further click on the same element runs
// nothing; the lock ends in `finally`, whatever the outcome. A handler that
// returns no promise (a fold, a dialog) locks nothing. The set holds the
// elements weakly and touches no attribute, so a node that a render replaces
// is free at once and a `disabled` of the view is never changed.
const running = new WeakSet<object>();

/**
 * Runs `run` for `el` unless a promise of an earlier run for `el` is pending.
 * Gives the promise of the run with the lock's `finally`, which settles as the
 * run did, or undefined when nothing ran or nothing is pending.
 */
export function runLocked(
  el: object,
  run: () => unknown,
): Promise<unknown> | undefined {
  if (running.has(el)) return undefined;
  const result = run();
  if (!(result instanceof Promise)) return undefined;
  running.add(el);
  return result.finally(() => running.delete(el));
}

/** Something that is submitted: its target (the form) and the default to prevent. */
interface Submit {
  target: EventTarget | null;
  preventDefault(): void;
}

/**
 * The submit of a form, by its id (#428, 284a): every form, the chats
 * included, stays locked while the promise of its handler runs, so two quick
 * Enter or a double click send once; it is free again when the action
 * ended, also after a refusal or a network error. A form without a handler
 * keeps its default.
 */
export function submitLocked(
  e: Submit,
  forms: Readonly<Record<string, () => unknown>>,
): Promise<unknown> | undefined {
  const form = e.target as { id?: string } | null;
  const id = form?.id;
  const handle = id && Object.hasOwn(forms, id) ? forms[id] : undefined;
  if (!form || !handle) return undefined;
  e.preventDefault();
  return runLocked(form, handle);
}

/** A submit of a form of a view: its form and the default to prevent. */
interface ViewSubmit {
  currentTarget: EventTarget | null;
  preventDefault(): void;
}

/**
 * The `onsubmit` of a form of a view (#428, 284a): the browser's default
 * is always stopped, and `handle` runs through `runLocked`, keyed by the
 * form, so a second submit while the promise of the first runs does
 * nothing. `handle` returns the promise of its action, or nothing locks.
 */
export const lockedSubmit =
  <E extends ViewSubmit>(handle: (e: E) => unknown) =>
  (e: E): void => {
    e.preventDefault();
    const form = e.currentTarget;
    if (form) void runLocked(form, () => handle(e));
  };
