// The cards of the overview on a phone (#189, D5; okf/features/interface.md):
// „Läuft“ (what builds, researches and orders on the shown place, with the
// time left and a bar), „Achtung“ (an attack on the way, too little energy)
// and „Bereit“ (a reward to claim, new messages, an empty build queue on
// another place). Pure, so the component
// OverviewCards.svelte only renders what this module computes. What counts as
// „Achtung“ and „Bereit“ is the proposal of the issue (all [V]).
import { ownedOnce } from '../../core/owned-once.ts';
import type { V } from '../views/common.ts';
import { type Countdown, activityRows } from './overview.ts';
import type { CardItem, OverviewLines } from './overview-cards/contract.ts';
import { OVERVIEW_LINES } from './overview-cards/lines.gen.ts';

export type { CardItem } from './overview-cards/contract.ts';
export { MOST_ATTACKS } from './overview-cards/attacks.ts';
export { MOST_IDLE } from './overview-cards/idle.ts';

/** An order of the shown place that is working, with its bar. */
export interface RunningItem {
  /** „Gebäude“, „Forschung“ or „Schiffsschmiede“. */
  label: string;
  what: string;
  due: Countdown;
  /** The bar: the length of the order or of the unit and how much has passed. */
  max: number;
  value: number;
  /** The shipyard counts down to its next unit, „(nächste)“. */
  next: boolean;
}

export interface OverviewCards {
  running: RunningItem[];
  attention: CardItem[];
  ready: CardItem[];
}

/** When the order of a label started and ends; the unit of the shipyard counts alone. */
function span(v: V, label: string): { start: number; end: number } {
  const { P, R, now } = v;
  if (label === 'Gebäude') return P.bq!;
  if (label === 'Forschung') return R.rq!;
  const start = P.sqT ?? now;
  return { start, end: start + P.sq[0]!.unit };
}

/** „Läuft“: the activities of the overview, each with its bar. */
export function runningItems(v: V): RunningItem[] {
  return activityRows(v).map((row) => {
    const { start, end } = span(v, row.label);
    const max = Math.max(end - start, 1);
    return {
      ...row,
      max,
      value: Math.min(Math.max(v.now - start, 0), max),
    };
  });
}

/** The modules as the generated list gives them: `[name in the folder, overviewLines]`. */
type ListedLines = readonly (readonly [string, readonly OverviewLines[]])[];

/** The cards a source may name. */
const CARDS: readonly OverviewLines['card'][] = ['attention', 'ready'];

/**
 * Stops the start at a source that cannot work: an unknown card (it would be
 * dropped), no order, no function `lines` (it would fail only when drawn), no
 * list of the kinds of its keys.
 */
function checkSource(source: OverviewLines, file: string): void {
  if (!CARDS.includes(source.card))
    throw new Error(
      `Overview line in ${file} has an unknown card "${String(source.card)}".`,
    );
  if (!Number.isFinite(source.order))
    throw new Error(`Overview line of ${source.card} in ${file} has no order.`);
  if (typeof source.lines !== 'function')
    throw new Error(`Overview line of ${source.card} in ${file} has no lines.`);
  if (!Array.isArray(source.keys))
    throw new Error(
      `Overview line of ${source.card} in ${file} names no kinds of keys.`,
    );
}

/**
 * The sources of each card by ascending order (#426); a card and an order,
 * or a kind of key in a card, defined twice stop the start with both files
 * named.
 */
export function assembleLines(
  listed: ListedLines,
): Record<OverviewLines['card'], readonly OverviewLines[]> {
  const once = ownedOnce('Overview line');
  const ownKey = ownedOnce('Overview line key');
  const all = listed.flatMap(([name, sources]) =>
    sources.map((source) => ({
      file: `src/client/logic/overview-cards/${name}.ts`,
      source,
    })),
  );
  for (const { file, source } of all) {
    checkSource(source, file);
    once(source.card, String(source.order), file);
    for (const kind of source.keys) ownKey(source.card, kind, file);
  }
  const of = (card: OverviewLines['card']): readonly OverviewLines[] =>
    all
      .map((a) => a.source)
      .filter((source) => source.card === card)
      .sort((a, b) => a.order - b.order);
  return { attention: of('attention'), ready: of('ready') };
}

const LINES = assembleLines(OVERVIEW_LINES);

/** „Achtung“: the hostile fleets on their way to the shown place, then too little energy. */
export const attentionItems = (v: V): CardItem[] =>
  LINES.attention.flatMap((source) => source.lines(v));

/** „Bereit“: a reward to claim, new messages, an empty build queue elsewhere. */
export const readyItems = (v: V): CardItem[] =>
  LINES.ready.flatMap((source) => source.lines(v));

/** The three cards of the shown place. */
export const overviewCards = (v: V): OverviewCards => ({
  running: runningItems(v),
  attention: attentionItems(v),
  ready: readyItems(v),
});
