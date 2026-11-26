// The lock of a clicked `data-act` element (#425, owner, 2026-11-26, 186a): while
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
