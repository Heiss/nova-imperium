// Explanation texts of catalog entries (issue #63): how a player wants them
// shown, and which text an entry has. Used by the server (the option is
// stored per player) and by the browser (the lists show the texts).

/** The modes of the option „Erklärungstexte“ in „Hilfe & Optionen“. */
export const EXPLAIN_MODES = ['always', 'icon', 'hidden'] as const;
export type ExplainMode = (typeof EXPLAIN_MODES)[number];

/** The mode of new and existing players: the (?) icon (D2). */
export const DEFAULT_EXPLAIN: ExplainMode = 'icon';

export const isExplainMode = (x: unknown): x is ExplainMode =>
  (EXPLAIN_MODES as readonly unknown[]).includes(x);

/**
 * The long explanation text of an entry, or null when it has none. Until the
 * texts arrive with the grimdark naming (#94), the short `ds` stands in (D4).
 */
export const longText = (def: { lt?: string; ds?: string }): string | null =>
  def.lt || def.ds || null;
