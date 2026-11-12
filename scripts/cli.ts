// Runs the main function of a script started from the command line: its
// return value is the exit code, an error prints its message and exits 1.
export function runCli(main: () => number): void {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
