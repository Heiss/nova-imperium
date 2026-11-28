// The contract of a line source of the overview cards (#426 part 4): a file
// of this folder exports `overviewLines`, its lines for „Achtung“ or
// „Bereit“ with their place `order` in the card; the list of the files is
// generated (scripts/gen-features.ts, lines.gen.ts), so overview-cards.ts
// names no source. An unknown card, a missing order or `lines`, and a card,
// order or kind of key defined twice stop the start with the file named.
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
  /**
   * The kinds of the keys of its lines: a key is `<kind>` or `<kind>:<id>`.
   * A kind is owned by one source of a card, so two sources never give one
   * key twice; a kind declared twice in a card stops the start ([V]).
   */
  keys: readonly string[];
  lines: (v: V) => CardItem[];
}
