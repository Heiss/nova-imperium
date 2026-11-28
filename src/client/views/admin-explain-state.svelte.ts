// Which explanation of the admin panel is open (#358): the key of its
// setting and the id of the „?“ that opened it, or null. A module of its own,
// so the panel and the „?“ buttons of the tab „Universum“ and of the dialog
// „Neue Runde“ share it over a render. `own` is what the admin typed into the
// field „Eigener Wert“ (#358, part 2): never saved nor sent, and gone when the
// panel closes or another „?“ opens it.
export const adminExplain = $state<{
  key: string | null;
  opener: string | null;
  own: string;
}>({
  key: null,
  opener: null,
  own: '',
});

/** Closes the explanation that is open, if any. */
export function forgetExplain(): void {
  adminExplain.key = null;
  adminExplain.opener = null;
  adminExplain.own = '';
}
