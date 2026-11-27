// The contract of a line source of the overview cards (#426 part 4): a file
// of this folder exports `overviewLines`, its lines for „Achtung“ or
// „Bereit“ with their place `order` in the card; the list of the files is
// generated (scripts/gen-features.ts, lines.gen.ts), so overview-cards.ts
// names no source.
import type { V } from '../../views/common.ts';
import type { Countdown } from '../overview.ts';

/** A line of „Achtung“ or „Bereit“; a link opens the view that fixes it. */
export interface CardItem {
  /**
   * The key of the line in its card (#369): the id of the fleet or the
   * place, or the kind of a line that stands once. The text is no key: two
   * fleets of one player from one place, or a planet named like its moon,
   * read the same.
   */
  key: string;
  text: string;
  /** The countdown of an attack. */
  due?: Countdown;
  link?: { view: string; label: string };
  /** A button that makes this place the shown one (data-act `selectPlanet`). */
  select?: { id: string; label: string };
}

/** One source of lines of a card, as a file exports it. */
export interface OverviewLines {
  card: 'attention' | 'ready';
  /** The place in the card: the sources go by ascending order. */
  order: number;
  lines: (v: V) => CardItem[];
}
