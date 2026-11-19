// What the phone view of the lists remembers while a list is mounted anew (a
// fresh render, another list of the switch): the filter and the rows the
// player unfolded (#189). Per device and session only; a reload starts with
// the default filter „Baubar“ (D4).
import { type BuildFilter, DEFAULT_FILTER } from './phone-build.ts';

export const phoneBuild = $state({
  filter: DEFAULT_FILTER as BuildFilter,
  /** The entries whose details are unfolded, by catalog key. */
  unfolded: {} as Record<string, boolean>,
});
