// The phone view of the lists of buildings, research, shipyard and defense
// (#189; owner, 2026-11-14, D2 to D4): one tab „Bauen“ with a switch between
// the four lists and a filter „Baubar“ (the default), „Alle“ and „Läuft“,
// compact rows whose details unfold on a tap, and the short button „▲ 5“.
// Pure, so CatalogList.svelte only renders what this module computes. The
// filter and the folding apply on a phone (up to 760 px) only: the CSS reads
// the data attributes, and the desktop shows every row as before (D6).
import { type CatalogRow, LOCKED } from './catalog-list.ts';

/** Where a row stands: an upgrade or order runs, it can be started, or its requirements are missing. */
export type Phase = 'running' | 'open' | 'locked';

/** The filter of the lists. */
export type BuildFilter = 'open' | 'all' | 'running';

/** The choices of the filter, in their order; „Baubar“ is the default (D4). */
export const FILTERS: readonly { key: BuildFilter; label: string }[] = [
  { key: 'open', label: 'Baubar' },
  { key: 'all', label: 'Alle' },
  { key: 'running', label: 'Läuft' },
];

export const DEFAULT_FILTER: BuildFilter = 'open';

/** Where this device keeps the filter (`localStorage`, like the animations switch). */
export const FILTER_KEY = 'nova.build.filter';

/**
 * The filter this device kept: what `raw` names, else „Baubar“ (D4), also for
 * a value the storage holds that is no filter and for no storage at all.
 */
export const filterFrom = (raw: string | null): BuildFilter =>
  FILTERS.find((f) => f.key === raw)?.key ?? DEFAULT_FILTER;

/** The switch between the four lists, by view (D2). */
export const SEGMENTS: readonly { view: string; label: string }[] = [
  { view: 'buildings', label: 'Gebäude' },
  { view: 'research', label: 'Forschung' },
  { view: 'shipyard', label: 'Schiffsschmiede' },
  { view: 'defense', label: 'Abwehr' },
];

/**
 * The phase of a row. An upgrade or a research that runs, or a unit of the
 * shipyard or defense with an order in the queue (`queued` holds their
 * keys), is running; an entry whose requirements are missing is locked;
 * everything else can be started, also when it waits for resources or the
 * queue.
 */
export function rowPhase(row: CatalogRow, queued: ReadonlySet<string>): Phase {
  const { action } = row;
  if (action.kind === 'upgrading' || action.kind === 'researching')
    return 'running';
  if (action.kind === 'order' && queued.has(row.key)) return 'running';
  return action === LOCKED ? 'locked' : 'open';
}

/** How many rows each filter shows. */
export function filterCounts(
  rows: readonly CatalogRow[],
  queued: ReadonlySet<string>,
): Record<BuildFilter, number> {
  const count = { open: 0, all: rows.length, running: 0 };
  for (const row of rows) {
    const phase = rowPhase(row, queued);
    if (phase === 'open') count.open += 1;
    if (phase === 'running') count.running += 1;
  }
  return count;
}

/** What the list says when its filter shows nothing [V]. */
export const EMPTY: Readonly<Record<BuildFilter, string>> = {
  open: 'Nichts ist baubar. „Alle“ zeigt auch, was noch fehlt.',
  all: '',
  running: 'Es läuft gerade nichts.',
};

/** The short label of a button that names a level: „Ausbauen auf Stufe 6“ becomes „▲ 6“. */
export function shortLabel(label: string): string | null {
  const level = /Stufe (\d+)/.exec(label);
  return level ? `▲ ${level[1]}` : null;
}

/** The time line of a row („Bauzeit“, „Forschungszeit“), which stays in the compact row. */
export const isTimeLine = (line: string): boolean =>
  line.startsWith('Bauzeit:') || line.startsWith('Forschungszeit:');
