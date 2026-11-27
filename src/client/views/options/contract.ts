// The contract of a box of „Optionen“ (#378; okf/architecture/patterns.md,
// section 16). A feature declares its box in its own module of this folder,
// exported under the fixed name `optionBoxes`; the list of all of them is
// generated (scripts/gen-features.ts, boxes.gen.ts), so Options.svelte and
// logic/options.ts name no box and a new box edits no shared place.
import type { Component } from 'svelte';
import type { OptionsSection } from '../../logic/phone-options.ts';
import type { V } from '../common.ts';

/** What a box component gets: the page (at least its own part) and its section. */
export interface BoxProps<P extends object> {
  page: P;
  section: OptionsSection;
}

/** One box of the page; `P` is the part of the page it shows. */
export interface OptionBox<P extends object> {
  /** The name of the box, once in the page. */
  key: string;
  /**
   * The place in the page: ascending, each number once. The boxes of today
   * stand at 10 (Optionen), 20 (Hauptplanet), 30 (Urlaubsmodus), 35 (Keine Wachen annehmen), 40 (Meine
   * Aktivität & Spielzeit), 50 (Rundenarchiv), 60 (Darstellung), 70 (Passwort
   * ändern), 80 (Passkeys), 90 (App installieren), 100 (Benachrichtigungen),
   * 110 (Browser-Benachrichtigungen), 120 (Problem melden), 130 (Account
   * löschen), 140 (the link „Dieses Universum“); take a free number between.
   */
  order: number;
  /** The section of the phone switch that shows it (#189). */
  section: OptionsSection;
  /** The component that draws the box, `data-sec` included. */
  component: Component<BoxProps<P>>;
  /** Its part of the page at the view state; none for a box without data. */
  data?: (v: V) => P;
  /** Whether the box is shown (default: always). */
  shown?: (page: P) => boolean;
}

/** A box, its type checked against its own component, data and condition. */
export const optionBox = <P extends object>(box: OptionBox<P>): OptionBox<P> =>
  box;
