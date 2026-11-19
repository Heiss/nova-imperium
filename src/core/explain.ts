// Explanation texts of catalog entries (issue #63): how a player wants them
// shown, and which text an entry has. Used by the server (the option is
// stored per player) and by the browser (the lists show the „?“, which
// opens the article of the Lexicanum since #285).

/**
 * The modes of the option „(?)-Symbol“ in „Hilfe & Optionen“ (#285 B2):
 * show the „?“, or hide it. „Immer anzeigen“ went with the Lexicanum.
 */
export const EXPLAIN_MODES = ['icon', 'hidden'] as const;
export type ExplainMode = (typeof EXPLAIN_MODES)[number];

/** The mode of new and existing players: the (?) icon (D2). */
export const DEFAULT_EXPLAIN: ExplainMode = 'icon';

export const isExplainMode = (x: unknown): x is ExplainMode =>
  (EXPLAIN_MODES as readonly unknown[]).includes(x);

/**
 * The mode „Immer anzeigen“ of #63, still stored for players who chose it
 * and sent by a client from before #285: it becomes the „?“ (#285 B2).
 */
export const OLD_ALWAYS = 'always';

/** A stored or sent mode as it counts now; undefined for no mode at all. */
export const storedMode = (x: unknown): ExplainMode | undefined =>
  x === OLD_ALWAYS ? 'icon' : isExplainMode(x) ? x : undefined;

/**
 * The long explanation text of an entry, or null when it has none. Until the
 * texts arrive with the grimdark naming (#94), the short `ds` stands in (D4).
 */
export const longText = (def: { lt?: string; ds?: string }): string | null =>
  def.lt || def.ds || null;
