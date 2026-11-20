// What the phone view of the lists remembers while a list is mounted anew (a
// fresh render, another list of the switch): the filter and the rows the
// player unfolded (#189). The filter is kept per device in `localStorage`, as
// the animations switch is, so a reload keeps it; without a stored choice, and
// where the storage is blocked, it is „Baubar“ (D4). The unfolded rows live
// for the session only.
import { type BuildFilter, FILTER_KEY, filterFrom } from './phone-build.ts';

function storedFilter(): string | null {
  try {
    return localStorage.getItem(FILTER_KEY);
  } catch {
    return null;
  }
}

export const phoneBuild = $state({
  filter: filterFrom(storedFilter()) as BuildFilter,
  /** The entries whose details are unfolded, by catalog key. */
  unfolded: {} as Record<string, boolean>,
});

/** Chooses the filter and keeps the choice on this device. */
export function chooseFilter(filter: BuildFilter): void {
  phoneBuild.filter = filter;
  try {
    localStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}
