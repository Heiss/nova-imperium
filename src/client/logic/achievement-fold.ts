// The achievements on a phone (#189, „Achievements grouped and folded, only
// the next goals open“; owner, 2026-11-14): the list has about a thousand
// entries, so up to 760 px the group „Offen“ shows only the next goal of each
// series and the group „Erledigt“ only a button, until the player unfolds
// them. The CSS reads the attributes this module and views/achievements.ts
// write; the desktop shows everything as before (D6).

/** The groups that can be unfolded. */
export type FoldGroup = 'open' | 'claimed';

/** Which groups the player unfolded; per session, so a reload folds them again. */
export const unfolded: Record<FoldGroup, boolean> = {
  open: false,
  claimed: false,
};

/** Unfolds a folded group, or folds it again. */
export function toggleFold(group: string): void {
  if (group === 'open' || group === 'claimed')
    unfolded[group] = !unfolded[group];
}

/**
 * The entries that are not the next goal of their series: an entry of the
 * series `metric(item)` that is still to do while an earlier one is too.
 * `items` are in the order of the catalog, the targets of a series ascending.
 */
export function laterGoals<T>(
  items: readonly T[],
  metric: (item: T) => string,
  done: (item: T) => boolean,
): Set<T> {
  const later = new Set<T>();
  const seen = new Set<string>();
  for (const item of items) {
    if (done(item)) continue;
    const m = metric(item);
    if (seen.has(m)) later.add(item);
    else seen.add(m);
  }
  return later;
}

/** The text of the button of a group [V]. */
export function foldLabel(group: FoldGroup, count: number): string {
  const open = unfolded[group];
  if (group === 'open')
    return open ? 'Nur die nächsten Ziele zeigen' : `Alle ${count} zeigen`;
  return open ? 'Erledigte ausblenden' : `${count} erledigte zeigen`;
}
