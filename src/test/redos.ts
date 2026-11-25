// For the tests of the regular expressions rewritten for the ReDoS lint
// (#367): the new form behaves like the old one on every text made of the
// pieces that matter, and a hostile text that took the old form seconds now
// takes next to nothing.
import fc from 'fast-check';
import { expect } from 'vitest';

/**
 * The bound for a hostile text of 50,000 characters. The old expressions
 * took 0.8 to 5 s on such a text (measured on 2026-11-25), the new ones
 * about 1 ms; the bound leaves room for a slow machine.
 */
const FAST_MS = 100;

/** The length of a hostile text. */
export const HOSTILE = 50_000;

/** Runs <work> and fails when it takes FAST_MS or more; returns its result. */
export function fast<T>(work: () => T): T {
  const start = performance.now();
  const result = work();
  expect(performance.now() - start).toBeLessThan(FAST_MS);
  return result;
}

/** Texts joined from <pieces>, up to <max> of them. */
const textOf = (pieces: readonly string[], max = 12) =>
  fc
    .array(fc.constantFrom(...pieces), { maxLength: max })
    .map((parts) => parts.join(''));

/** Checks <same> on many texts joined from <pieces>. */
export function sameOn(
  pieces: readonly string[],
  same: (text: string) => void,
  max = 12,
): void {
  fc.assert(
    fc.property(textOf(pieces, max), (text) => {
      same(text);
    }),
    { numRuns: 2000 },
  );
}
