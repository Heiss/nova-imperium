// The contract of a client view (okf/architecture/patterns.md, section 16;
// #317). A view registers itself in its own module of this folder, exported
// under the fixed name `clientViews`; the list of all of them is generated
// (scripts/gen-features.ts, views.gen.ts), so `mount.ts` and `index.ts` name
// no new view and a new one edits no shared place.
import type { RoundRules } from '../../core/round.ts';
import type { V } from './common.ts';

/** A mounted Svelte view: its name, its update (a list follows the state) and how to take it down. */
export interface Mounted {
  view: string;
  update?: (v: V) => void;
  destroy: () => void;
}

/** Mounts a Svelte view into the target. */
export type Mount = (target: HTMLElement, v: V) => Omit<Mounted, 'view'>;

/** The place of a view in the menu (the sidebar, and „Mehr“ of a phone). */
export interface MenuItem {
  /**
   * The place among all entries: ascending, each number once. The entries of
   * today stand at 10 (Übersicht), 20 (Gebäude), 30 (Rohstoffe), 40
   * (Marktplatz), 50 (Forschung), 60 (Schiffsschmiede), 70 (Verteidigung),
   * 80 (Flotte), 90 (Sternenkarte), 100 (Nachrichten), 110 (Highscore),
   * 120 (Gilden), 130 (Freunde), 140 (Achievements), 150 (Neuigkeiten),
   * 160 (Lexicanum), 170 (Optionen), 180 (Admin); take a free number between.
   */
  order: number;
  /** The German label; a function when it depends on the round. */
  label: string | ((round: RoundRules) => string);
  /** Shown only when this holds (default: always); the admin entry needs `admin`. */
  show?: (round: RoundRules, admin: boolean) => boolean;
  /** A divider line before the entry. */
  divider?: boolean;
}

/** The place of a view in the bottom tab bar of a phone. */
export interface Tab {
  /** The place among the tabs: ascending, each number once. */
  order: number;
  /** The label where it differs from the menu („Bauen“). */
  label?: string;
}

/** One view; a module exports `clientViews`, a list of these. */
export interface ClientView {
  /** The name of the view: its address, `data-view` and the key of the state of the page. */
  key: string;
  /** A Svelte view: how it is mounted. Exactly one of `mount` and `html`. */
  mount?: Mount;
  /** A view still drawn as an HTML string. */
  html?: (v: V) => string;
  /** Mounted anew on every render, as its HTML was rendered anew (#118). Only with `mount`. */
  anew?: boolean;
  /** The entry in the menu; a view without one is reached by a link only. */
  menu?: MenuItem;
  /** The line icon (an `<svg>` string) of the menu entry and the tab. */
  glyph?: string;
  tab?: Tab;
}
