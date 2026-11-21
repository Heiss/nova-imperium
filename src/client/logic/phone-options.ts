// „Optionen“ in sections on a phone (#189; „Hilfe & Optionen in sections“ of
// the proposal): a switch of five sections, each showing some of the boxes of
// the page, so the page is no longer 2,900 px long. Up to 760 px only: the
// CSS reads `data-section` of the container and `data-sec` of each box, and
// the desktop shows every box as before (D6). Names and grouping are [V]; the
// owner decided only that the page is in sections. Spiel: the choices and the
// main planet; Runde: vacation mode, play time, round archive; Konto:
// password, passkeys, delete; Gerät: display, install, notifications; Hilfe:
// the problem report and the link to the rules (Options.svelte gives each box
// its section).

/** A section of the page. */
export type OptionsSection = 'game' | 'round' | 'account' | 'device' | 'other';

/** The switch, in its order; the first is shown first. */
export const OPTION_SECTIONS: readonly {
  key: OptionsSection;
  label: string;
}[] = [
  { key: 'game', label: 'Spiel' },
  { key: 'round', label: 'Runde' },
  { key: 'account', label: 'Konto' },
  { key: 'device', label: 'Gerät' },
  { key: 'other', label: 'Weiteres' },
];

export const DEFAULT_SECTION: OptionsSection = 'game';
