// One save at a time, the newest value last (CodeRabbit on #455, as
// `pushSaver` for the push kinds, #204): a value that comes while a save
// runs waits; when the running save returns, the newest waiting value is
// sent, so an older answer never undoes a newer click. A failed save shows
// its own toast (`act` answers false, it does not throw); a save that throws
// ends the run, and the next value starts a new one.

/**
 * The function for a new value: it resolves when no save runs any more. A
 * value equal to the one just sent is not sent again.
 */
export function latestSaver<T>(
  save: (value: T) => Promise<unknown>,
): (value: T) => Promise<void> {
  let wanted: T;
  let running: Promise<void> | null = null;
  const run = async (): Promise<void> => {
    let sent: T;
    try {
      do {
        sent = wanted;
        await save(sent);
      } while (!Object.is(wanted, sent));
    } finally {
      // Saved or thrown: the next value starts a save of its own.
      running = null;
    }
  };
  return (value) => {
    wanted = value;
    running ??= run();
    return running;
  };
}
