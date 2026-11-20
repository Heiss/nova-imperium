// What the phone view of „Optionen“ remembers while the page is mounted anew
// (a fresh render, a refresh of the state): the section that is shown (#189).
// Per session; a reload starts with the first section.
import { DEFAULT_SECTION, type OptionsSection } from './phone-options.ts';

export const phoneOptions = $state({
  section: DEFAULT_SECTION as OptionsSection,
});
